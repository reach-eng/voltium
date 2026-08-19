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

import { parsePermissions, type SessionPayload } from './permissions';
export { ADMIN_ROLES, type AdminRole, type SessionPayload } from './permissions';

// Session cookie configuration
export const SESSION_COOKIE_NAME = 'voltium-session';
export const ADMIN_SESSION_COOKIE_NAME = 'voltium-admin-session';

// PR-112 (SEC PR-5): cookie `secure` flag is set in any production-adjacent
// env (APP_ENV=production|staging wins; NODE_ENV=production is a fallback
// for plain Next.js prod builds). Misconfigured prod with APP_ENV=staging
// must still get the secure cookie.
const SESSION_COOKIE_SECURE =
  process.env.APP_ENV === 'production' ||
  process.env.APP_ENV === 'staging' ||
  process.env.NODE_ENV === 'production';

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: SESSION_COOKIE_SECURE,
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days (cookie TTL; token itself is shorter)
};

const ACTUAL_SECRET = new TextEncoder().encode(env.JWT_SECRET);
const ACCESS_TOKEN_TTL = '2h';
const REFRESH_TOKEN_TTL = '30d';

// P1-12: the numeric TTL the refresh route reports back to clients. Keep in
// sync with ACCESS_TOKEN_TTL ('2h') above — the old hardcoded 3600s lied
// about the real 2-hour expiry.
export const ACCESS_TOKEN_TTL_SECONDS = 2 * 60 * 60;

// P1-8: admin JWTs have no phone number. A literal marker is used instead of
// the admin's email so rider-shaped consumers (e.g. getRiderPhone, phone
// logging) can never surface an admin's email address.
export const ADMIN_SESSION_PHONE_MARKER = 'admin';

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
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
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

    // P2-12: tokens minted before the tokenVersion field was added default
    // to 1. That matches the default DB value (also 1), so legacy tokens stay
    // valid; only admins backfilled to a different version need a refresh.
    const tokenVersion = decoded.tokenVersion ?? 1;
    let currentVersion: number | null = 1;
    let adminDbError = false;

    try {
      if (decoded.role === 'admin') {
        // P2-11: admin tokens are minted with adminId === riderDbId (P1-15),
        // so the fallback only matters for pre-refactor legacy tokens — the
        // DB id is identical either way.
        const adminId = decoded.adminId || decoded.riderDbId;
        // P0-5 (audit #1): the 30s→5s cache still left a window where a
        // deactivated (or compromised-and-detected) admin kept valid sessions.
        // The admin check is now an UNcached fresh read every request: isActive
        // takes effect immediately, and a demotion/permission edit applies to
        // already-issued tokens on the very next request. The admin API surface
        // is low-TPS, so one indexed lookup per request is cheap compared to a
        // security window. (Riders keep the 30s cache below — no privileged
        // surface, documented trade-off.)
        const admin = await db.admin.findUnique({
          where: { id: adminId },
          select: { tokenVersion: true, isActive: true, role: true, permissions: true },
        });
        if (!admin) return null;
        currentVersion = admin.tokenVersion;

        if (!admin.isActive) {
          logger.info('[Auth] Admin is deactivated. Token rejected.', { adminId });
          return null;
        }

        // P1-18: fresh role/permissions from the same uncached read — a
        // demotion or permission edit applies to already-issued tokens
        // immediately. The JWT payload is mutated server-side only; the
        // client's copy is refreshed on the next /me or refresh call.
        if (admin.role && admin.role !== decoded.adminRole) {
          decoded.adminRole = admin.role;
        }

        if (admin.permissions) {
          // P3-19 follow-up: the column is TEXT[] (migration 20260730000000),
          // so Prisma returns a real string[] — JSON.parse coerces arrays to a
          // comma-joined string, always throws, and silently fell back to
          // role-derived permissions. The shared parser handles arrays and
          // legacy JSON strings alike, so explicit per-admin permissions now
          // actually reach the JWT.
          decoded.adminPermissions = parsePermissions(admin.permissions);
        }
      } else {
        const riderDbId = decoded.riderDbId;
        // P2-14: riders keep a 30s cache (same race window the admin path
        // had before P0-5). Riders have no privileged surface, so a revoked
        // rider token being usable for up to 30s is accepted in exchange for
        // 6× fewer DB hits than the admin path.
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
      adminDbError = true;
    }

    // P1-19: fail closed for admin sessions. A DB outage must never make a
    // possibly-revoked admin token valid — reject instead of skipping the
    // version comparison. Riders stay lenient (no sensitive endpoints).
    if (adminDbError && decoded.role === 'admin') {
      logger.warn('[Auth] Admin tokenVersion DB check failed — rejecting token (fail closed)');
      return null;
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
      // P0-3 / P0-9: surface the token kind marker and the signed version so
      // refresh routes can enforce type === 'refresh' and compare versions
      // instead of reading them back via `as any` (which was silently
      // undefined and made rotation checks always fail).
      type: decoded.type,
      tokenVersion,
    };
  } catch (err) {
    // P2-15/P3-12: jwtVerify throws on expiry, bad signature, etc. — this is
    // an expected path (expired tokens are normal), so log at warn with only
    // the error *name* (never the raw error, which could embed token bytes).
    logger.warn('[Auth] Token verification failed (expired or invalid)', {
      code: err instanceof Error ? err.name : 'Unknown',
    });
    return null;
  }
}

export * from './permissions';
