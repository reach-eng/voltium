/**
 * POST /api/admin/auth/refresh — Refresh an expiring admin session token.
 *
 * Returns a new JWT with an extended expiry if the current refresh token is valid.
 * The old token version is invalidated (rolled forward) so a stolen refresh
 * token cannot be replayed forever. Racing retries (two tabs, Flutter web +
 * admin panel, a client retrying a timed-out request) are tolerated via a
 * 60-second sliding window so retry storms don't log admins out (P0-9).
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { db } from '@/lib/db';
import {
  verifySessionToken,
  createSessionToken,
  createRefreshToken,
  ADMIN_SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  ADMIN_SESSION_PHONE_MARKER,
  ACCESS_TOKEN_TTL_SECONDS,
} from '@/lib/auth';
import { parsePermissions } from '@/lib/permissions';
import { recordTokenBump, acceptStaleVersion } from '@/lib/session-rotation';
import { logger } from '@/lib/logger';
import { rateLimitIdentifierFromRequest } from '@/lib/rate-limit-middleware';

export async function POST(request: NextRequest) {
  try {
    // P3-9: SOC2 — refresh events must be attributable to a source IP.
    const clientIp = rateLimitIdentifierFromRequest(request).replace(/^ip:/, '');

    // P2-7: a malformed JSON body is a client error — say so directly rather
    // than falling through to the generic 'Missing refreshToken'.
    let body: { refreshToken?: string };
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid JSON body');
    }
    const { refreshToken } = body;

    if (!refreshToken) {
      return errors.badRequest('Missing refreshToken');
    }

    // P0-3: only a genuine refresh token (type === 'refresh') may be
    // exchanged. An access token has no `type` claim — passing one here must
    // never mint a fresh 2h token + fresh 30d refresh token.
    const session = await verifySessionToken(refreshToken);
    if (!session || session.role !== 'admin' || session.type !== 'refresh' || !session.adminId) {
      return errors.unauthorized('Invalid or expired admin refresh token');
    }

    const admin = await db.admin.findUnique({
      where: { id: session.adminId },
      select: {
        id: true,
        email: true,
        role: true,
        tokenVersion: true,
        isActive: true,
        permissions: true,
      },
    });

    if (!admin || !admin.isActive) {
      return errors.unauthorized('Admin deactivated or not found');
    }

    // P0-9: rotate with a compare-and-set so two truly concurrent refreshes
    // can't both increment past each other, and accept a retry that is
    // exactly one version behind within the 60s sliding window.
    // P2-8: the old two-step update (increment, then write payload) was
    // vulnerable to a partial failure leaving a stale payload; the CAS
    // updateMany + re-read below is atomic and the sliding window absorbs
    // the failure case (version bumped, no token issued -> retry is one
    // version behind and lands in the grace path).
    const tokenVersion = session.tokenVersion ?? 1;
    const currentVersion = admin.tokenVersion;
    let issuedVersion: number;

    if (tokenVersion === currentVersion) {
      const updated = await db.admin.updateMany({
        where: { id: admin.id, tokenVersion: currentVersion },
        data: { tokenVersion: { increment: 1 } },
      });
      if (updated.count === 0) {
        // Lost a race — someone else rotated first. Re-read and fall into
        // the sliding-window path so the retry still succeeds.
        const fresh = await db.admin.findUnique({
          where: { id: admin.id },
          select: { tokenVersion: true },
        });
        const freshVersion = fresh?.tokenVersion ?? currentVersion;
        if (!acceptStaleVersion(admin.id, tokenVersion, freshVersion)) {
          return errors.unauthorized('Session revoked');
        }
        issuedVersion = freshVersion;
      } else {
        issuedVersion = currentVersion + 1;
        recordTokenBump(admin.id, currentVersion, issuedVersion);
      }
    } else if (acceptStaleVersion(admin.id, tokenVersion, currentVersion)) {
      // Retry of a token we already rotated within the last 60s — issue new
      // tokens at the current version without rotating again.
      issuedVersion = currentVersion;
    } else {
      return errors.unauthorized('Session revoked');
    }

    const parsedPermissions = parsePermissions(admin.permissions);

    const payload = {
      riderId: admin.id, // For compatibility
      riderDbId: admin.id,
      phone: ADMIN_SESSION_PHONE_MARKER, // P1-8: never the admin's email
      role: 'admin',
      adminRole: admin.role,
      adminId: admin.id,
      adminPermissions: parsedPermissions,
      tokenVersion: issuedVersion,
    };

    // Issue new token and refresh token
    const newToken = await createSessionToken(payload);
    const newRefreshToken = await createRefreshToken(payload);

    logger.info('[AdminAuthRefresh] Token refreshed', { adminId: admin.id, ip: clientIp });

    const response = success({
      token: newToken,
      refreshToken: newRefreshToken,
      // P1-12: report the real access-token TTL (2h), not a hardcoded 1h.
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });

    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, newToken, SESSION_COOKIE_OPTIONS);

    return response;
  } catch (err: unknown) {
    logger.error('[AdminAuthRefresh] Failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errors.internal('Failed to refresh admin session');
  }
}
