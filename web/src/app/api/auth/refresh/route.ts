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

    // Check token version hasn't been revoked
    if (rider.tokenVersion !== (session as any).tokenVersion) {
      return errors.unauthorized('Session revoked');
    }

    // Increment token version to invalidate the old token
    await db.rider.update({
      where: { id: rider.id },
      data: { tokenVersion: { increment: 1 } },
    });

    const payload = {
      riderId: rider.riderId,
      riderDbId: rider.id,
      phone: rider.phone,
      role: 'rider',
      tokenVersion: rider.tokenVersion + 1,
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
