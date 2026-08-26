/**
 * RBAC core for admin roles and permissions (PR-A)
 * Expanded roles: SUPER_ADMIN, OPERATIONS_ADMIN, KYC_REVIEWER, FINANCE_ADMIN, SUPPORT_AGENT, HUB_MANAGER, FLEET_MANAGER, READ_ONLY
 *
 * JWT creation/verification uses the `jose` library with HS256.
 * Access tokens: 2 hour expiry
 * Refresh tokens:  30 day expiry
 */

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
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
  maxAge: 60 * 60 * 24 * 7, // 7 days (cookie TTL; token itself is shorter)
};

const ACTUAL_SECRET = new TextEncoder().encode(env.JWT_SECRET);
const ACCESS_TOKEN_TTL = '2h';
const REFRESH_TOKEN_TTL = '30d';

// ── Token creation ──────────────────────────────────────────────────────────

/**
 * Create a signed JWT access token (2h expiry).
 */
export async function createSessionToken(payload: {
  riderId: string;
  riderDbId: string;
  phone: string;
  role: string;
  adminRole?: string;
  adminId?: string;
  adminPermissions?: string[];
  tokenVersion?: number;
}): Promise<string> {
  if (!payload.riderId || !payload.riderDbId || !payload.phone) {
    throw new Error('Invalid payload: Missing required fields');
  }

  const token = await new SignJWT({
    ...payload,
    tokenVersion: payload.tokenVersion ?? 1,
  } as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .setIssuer('voltium-api')
    .setAudience('voltium-app')
    .setSubject(payload.riderDbId)
    .sign(ACTUAL_SECRET);

  return token;
}

/**
 * Create a refresh token with longer expiry (30 days).
 * Uses the same HS256 JWT format with a 'refresh' type marker.
 */
export async function createRefreshToken(payload: {
  riderId: string;
  riderDbId: string;
  phone: string;
  role: string;
  adminRole?: string;
  adminId?: string;
  adminPermissions?: string[];
  tokenVersion?: number;
}): Promise<string> {
  const token = await new SignJWT({
    ...payload,
    type: 'refresh',
    tokenVersion: payload.tokenVersion ?? 1,
  } as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .setIssuer('voltium-api')
    .setAudience('voltium-app')
    .setSubject(payload.riderDbId)
    .sign(ACTUAL_SECRET);

  return token;
}

// ── Token verification ──────────────────────────────────────────────────────

// Extend JWTPayload with our custom fields for decoding
interface VoltiumJwtPayload extends JWTPayload {
  riderId?: string;
  riderDbId?: string;
  phone?: string;
  role?: string;
  adminRole?: string;
  adminId?: string;
  adminPermissions?: string[];
  tokenVersion?: number;
  type?: string;
}

/**
 * Verify and decode a session/refresh token.
 * The second parameter (context) is unused — kept for backward compatibility.
 */
export async function verifySessionToken(
  token: string,
  _context?: string
): Promise<SessionPayload | null> {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const { payload } = await jwtVerify(token, ACTUAL_SECRET, {
      issuer: 'voltium-api',
      audience: 'voltium-app',
    });

    const decoded = payload as VoltiumJwtPayload;

    if (!decoded.riderId || !decoded.riderDbId || !decoded.phone) {
      return null;
    }

    const tokenVersion = decoded.tokenVersion ?? 1;
    let currentVersion: number | null = 1;

    try {
      if (decoded.role === 'admin') {
        const adminId = decoded.adminId || decoded.riderDbId;
        const cached = await getOrSetResponse(
          `token_version:admin:${adminId}`,
          async () => {
            const admin = await db.admin.findUnique({
              where: { id: adminId },
              select: { tokenVersion: true, isActive: true, role: true, permissions: true },
            });
            return {
              tokenVersion: admin?.tokenVersion ?? 1,
              isActive: admin?.isActive ?? true,
              role: admin?.role ?? null,
              permissions: admin?.permissions ?? null,
            };
          },
          30
        );
        if (!cached) return null;
        currentVersion = cached.tokenVersion;

        if (!cached.isActive) {
          logger.info('[Auth] Admin is deactivated. Token rejected.', { adminId });
          return null;
        }

        if (cached.role && cached.role !== decoded.adminRole) {
          decoded.adminRole = cached.role;
        }

        if (cached.permissions) {
          try {
            decoded.adminPermissions = JSON.parse(cached.permissions);
          } catch {
            // ignore parse errors
          }
        }
      } else {
        const riderDbId = decoded.riderDbId;
        currentVersion = await getOrSetResponse(
          `token_version:rider:${riderDbId}`,
          async () => {
            const rider = await db.rider.findUnique({
              where: { id: riderDbId },
              select: { tokenVersion: true },
            });
            return rider?.tokenVersion ?? 1;
          },
          30
        );
      }
    } catch (err) {
      logger.error('[Auth] Failed to verify tokenVersion against database:', err);
    }

    if (currentVersion !== null && tokenVersion !== currentVersion) {
      logger.info('[Auth] Token version mismatch. Token is revoked.', {
        tokenVersion,
        currentVersion,
      });
      return null;
    }

    return {
      riderId: decoded.riderId!,
      riderDbId: decoded.riderDbId!,
      phone: decoded.phone!,
      role: decoded.role!,
      adminRole: decoded.adminRole,
      adminId: decoded.adminId,
      adminPermissions: decoded.adminPermissions as string[] | undefined,
    };
  } catch (err) {
    // jwtVerify throws on expiry, bad signature, etc.
    logger.error('[Auth] Token verification failed:', err);
    return null;
  }
}

export * from './permissions';
