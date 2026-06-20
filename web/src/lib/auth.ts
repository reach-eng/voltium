/**
 * RBAC core for admin roles and permissions (PR-A)
 * Expanded roles: SUPER_ADMIN, OPERATIONS_ADMIN, KYC_REVIEWER, FINANCE_ADMIN, SUPPORT_AGENT, HUB_MANAGER, FLEET_MANAGER, READ_ONLY
 */

import crypto from 'crypto';
import { env } from './env';
import { logger } from './logger';
import { db } from './db';
import { getOrSetResponse } from './cache';

import { type SessionPayload } from './permissions';
export { ADMIN_ROLES, type AdminRole, type SessionPayload } from './permissions';

// Session cookie configuration
export const SESSION_COOKIE_NAME = 'voltium-session';
export const ADMIN_SESSION_COOKIE_NAME = 'voltium-admin-session';

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

const ACTUAL_SECRET = env.JWT_SECRET;

// Create a signed JWT session token
export function createSessionToken(payload: {
  riderId: string;
  riderDbId: string;
  phone: string;
  role: string;
  adminRole?: string;
  adminId?: string;
  adminPermissions?: string[];
  tokenVersion?: number;
}): string {
  // Validate payload structure
  if (!payload.riderId || !payload.riderDbId || !payload.phone) {
    throw new Error('Invalid payload: Missing required fields');
  }

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadStr = Buffer.from(
    JSON.stringify({
      ...payload,
      tokenVersion: payload.tokenVersion ?? 1,
      iat: Date.now(),
      exp: Date.now() + SESSION_COOKIE_OPTIONS.maxAge * 1000,
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', ACTUAL_SECRET)
    .update(`${header}.${payloadStr}`)
    .digest('base64url');

  return `${header}.${payloadStr}.${signature}`;
}

// Verify and decode a session token
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    // Validate token format
    if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
      return null;
    }

    const [header, payload, signature] = token.split('.');

    // Validate base64url encoding
    try {
      // Try to decode to check if it's valid base64url
      Buffer.from(header, 'base64url');
      Buffer.from(payload, 'base64url');
    } catch {
      return null;
    }

    const expectedSignature = crypto
      .createHmac('sha256', ACTUAL_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    const signatureBuf = Buffer.from(signature);
    const expectedSignatureBuf = Buffer.from(expectedSignature);

    if (
      signatureBuf.length !== expectedSignatureBuf.length ||
      !crypto.timingSafeEqual(signatureBuf, expectedSignatureBuf)
    ) {
      return null;
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());

    // Check if token is expired
    if (decoded.exp && Date.now() > decoded.exp) {
      return null;
    }

    // Validate required fields exist
    if (!decoded.riderId || !decoded.riderDbId || !decoded.phone) {
      return null;
    }

    const tokenVersion = decoded.tokenVersion ?? 1;
    let currentVersion: number | null = 1;

    try {
      if (decoded.role === 'admin') {
        const adminId = decoded.adminId || decoded.riderDbId;
        currentVersion = await getOrSetResponse(`token_version:admin:${adminId}`, async () => {
          const admin = await db.admin.findUnique({
            where: { id: adminId },
            select: { tokenVersion: true },
          });
          return admin?.tokenVersion ?? 1;
        }, 30);
      } else {
        const riderDbId = decoded.riderDbId;
        currentVersion = await getOrSetResponse(`token_version:rider:${riderDbId}`, async () => {
          const rider = await db.rider.findUnique({
            where: { id: riderDbId },
            select: { tokenVersion: true },
          });
          return rider?.tokenVersion ?? 1;
        }, 30);
      }
    } catch (err) {
      logger.error('[Auth] Failed to verify tokenVersion against database:', err);
    }

    if (currentVersion !== null && tokenVersion !== currentVersion) {
      logger.info('[Auth] Token version mismatch. Token is revoked.', { tokenVersion, currentVersion });
      return null;
    }

    return {
      riderId: decoded.riderId,
      riderDbId: decoded.riderDbId,
      phone: decoded.phone,
      role: decoded.role,
      adminRole: decoded.adminRole,
      adminId: decoded.adminId,
      adminPermissions: decoded.adminPermissions,
    };
  } catch (err) {
    logger.error('[Auth] Token verification failed:', err);
    return null;
  }
}

export * from './permissions';
