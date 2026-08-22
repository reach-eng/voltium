/**
 * POST /api/auth/refresh — Refresh an expiring session token.
 *
 * Returns a new JWT with an extended expiry if the current token is valid.
 * No OTP required — uses the existing session to authenticate.
 * The old token version is invalidated (rolled forward).
 *
 * This enables silent background token refresh in the Flutter app.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { db } from '@/lib/db';
import {
  verifySessionToken,
  createSessionToken,
  createRefreshToken,
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/auth';
import { logger } from '@/lib/logger';
import { recordTokenBump, acceptStaleVersion } from '@/lib/session-rotation';
import { logSecurityEvent } from '@/lib/security-events';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const refreshToken = request.cookies.get('voltium_refresh')?.value || body.refreshToken;

    if (!refreshToken) {
      return errors.badRequest('Missing refreshToken');
    }

    // P0-3 (admin audit, same class): only a genuine refresh token may be
    // exchanged — an access token passed here must never mint a fresh 30d
    // refresh token.
    const session = await verifySessionToken(refreshToken);
    if (!session || session.type !== 'refresh') {
      return errors.unauthorized('Invalid or expired refresh token');
    }

    const rider = await db.rider.findUnique({
      where: { id: session.riderDbId },
      select: {
        id: true,
        riderId: true,
        phone: true,
        tokenVersion: true,
        lifecycleStatus: true,
      },
    });

    if (!rider) {
      return errors.unauthorized('Rider not found');
    }

    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();

    // AUDIT FIX (N-12): rotate with a COMPARE-AND-SET and reuse detection,
    // mirroring the hardened admin refresh route.
    //
    // Old behavior: an unconditional `{ increment: 1 }` meant two
    // concurrent refreshes of the same valid token BOTH minted new token
    // pairs (family forking), and a replayed stale token just got a silent
    // 401 — no security event, so stolen-token reuse was undetectable.
    const presentedVersion = (session as any).tokenVersion ?? 1;
    const currentVersion = rider.tokenVersion;
    let issuedVersion: number;

    if (presentedVersion === currentVersion) {
      // CAS: only the FIRST concurrent refresh wins the rotation.
      const updated = await db.rider.updateMany({
        where: { id: rider.id, tokenVersion: currentVersion },
        data: { tokenVersion: { increment: 1 } },
      });
      if (updated.count === 0) {
        // Lost the race — another request already rotated. Re-read and
        // fall into the sliding-window grace path so an innocent racing
        // retry still succeeds.
        const fresh = await db.rider.findUnique({
          where: { id: rider.id },
          select: { tokenVersion: true },
        });
        const freshVersion = fresh?.tokenVersion ?? currentVersion;
        if (!acceptStaleVersion(rider.id, presentedVersion, freshVersion)) {
          // Rotation we didn't perform → likely token theft.
          void logSecurityEvent({
            type: 'refresh_token_reuse',
            severity: 'warning',
            actorId: rider.id,
            ip: clientIp,
            details: { presentedVersion, currentVersion: freshVersion },
          }).catch(() => {});
          return errors.unauthorized('Session revoked');
        }
        issuedVersion = freshVersion;
      } else {
        issuedVersion = currentVersion + 1;
        recordTokenBump(rider.id, currentVersion, issuedVersion);
      }
    } else if (acceptStaleVersion(rider.id, presentedVersion, currentVersion)) {
      // Innocent retry of a token WE rotated within the last 60s — issue
      // new tokens at the current version without rotating again.
      issuedVersion = currentVersion;
    } else {
      // REUSE DETECTED: a token at least one version behind that we did
      // NOT rotate is a replayed/stolen credential. Log it loudly so
      // account-takeover monitoring can act.
      void logSecurityEvent({
        type: 'refresh_token_reuse',
        severity: 'critical',
        actorId: rider.id,
        ip: clientIp,
        details: { presentedVersion, currentVersion },
      }).catch(() => {});
      logger.warn('[AuthRefresh] Refresh-token reuse detected', {
        riderDbId: rider.id,
        presentedVersion,
        currentVersion,
      });
      return errors.unauthorized('Session revoked');
    }

    const payload = {
      riderId: rider.riderId,
      riderDbId: rider.id,
      phone: rider.phone,
      role: 'rider',
      tokenVersion: issuedVersion,
    };

    // Issue new token and refresh token
    const newToken = await createSessionToken(payload);
    const newRefreshToken = await createRefreshToken(payload);

    logger.info('[AuthRefresh] Token refreshed', { riderDbId: rider.id });

    // BLOCKER 1.5: re-set the rider session cookie so the Flutter Web
    // build served at /rider-app/ picks up the new access token on
    // its next request. Without this, the browser would keep sending
    // the old (now revoked) cookie and get 401 immediately.
    //
    // Mobile apps use the Authorization: Bearer header from the body
    // and are unaffected. This change is web-only in effect.
    const response = success({
      token: newToken,
      refreshToken: newRefreshToken,
      expiresIn: 60 * 60, // 1 hour in seconds
    });
    response.cookies.set(SESSION_COOKIE_NAME, newToken, SESSION_COOKIE_OPTIONS);
    response.cookies.set('voltium_refresh', newRefreshToken, {
      ...SESSION_COOKIE_OPTIONS,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });
    return response;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err);
    logger.error('[AuthRefresh] Failed', { error: errorMessage });
    return errors.internal('Failed to refresh session');
  }
}
