/**
 * POST /api/admin/auth/refresh — Refresh an expiring admin session token.
 *
 * Returns a new JWT with an extended expiry if the current refresh token is valid.
 * The old token version is invalidated (rolled forward).
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { db } from '@/lib/db';
import { verifySessionToken, createSessionToken, createRefreshToken, ADMIN_SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { refreshToken } = body;

    if (!refreshToken) {
      return errors.badRequest('Missing refreshToken');
    }

    const session = await verifySessionToken(refreshToken, 'Refresh');
    if (!session || session.role !== 'admin' || !session.adminId) {
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

    // Check token version hasn't been revoked
    if (admin.tokenVersion !== (session as any).tokenVersion) {
      return errors.unauthorized('Session revoked');
    }

    // Increment token version to invalidate the old token
    await db.admin.update({
      where: { id: admin.id },
      data: { tokenVersion: { increment: 1 } },
    });

    let parsedPermissions: string[] = [];
    try {
      parsedPermissions = admin.permissions ? JSON.parse(admin.permissions) : [];
    } catch {
      parsedPermissions = [];
    }

    const payload = {
      riderId: admin.id, // For compatibility
      riderDbId: admin.id,
      phone: admin.email,
      role: 'admin',
      adminRole: admin.role,
      adminId: admin.id,
      adminPermissions: parsedPermissions,
      tokenVersion: admin.tokenVersion + 1,
    };

    // Issue new token and refresh token
    const newToken = await createSessionToken(payload);
    const newRefreshToken = await createRefreshToken(payload);

    logger.info('[AdminAuthRefresh] Token refreshed', { adminId: admin.id });

    const response = success({
      token: newToken,
      refreshToken: newRefreshToken,
      expiresIn: 60 * 60, // 1 hour in seconds
    });

    response.cookies.set(ADMIN_SESSION_COOKIE_NAME, newToken, SESSION_COOKIE_OPTIONS);

    return response;
  } catch (err: unknown) {
    logger.error('[AdminAuthRefresh] Failed', { error: (err instanceof Error ? err.message : String(err)) });
    return errors.internal('Failed to refresh admin session');
  }
}
