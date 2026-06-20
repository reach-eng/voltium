import { cookies } from 'next/headers';
import {
  verifySessionToken,
  type SessionPayload,
  SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
} from './auth';
import { logger } from './logger';

async function getCookie(name: string): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(name)?.value;
}

/**
 * Get the current session from the `voltium-session` cookie or Authorization header.
 *
 * Returns `null` if no session exists or the token is invalid/expired.
 */
export async function getSession(request?: Request): Promise<SessionPayload | null> {
  let token: string | undefined;

  // 1. Try to get token from Authorization header (common for mobile/API)
  if (request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  // 2. Fallback to session cookie (common for web)
  if (!token) {
    token = await getCookie(SESSION_COOKIE_NAME);
  }

  if (!token) return null;
  return await verifySessionToken(token);
}

/**
 * Get the admin session from cookie or Authorization header.
 *
 * Returns `null` if no session exists, the token is invalid/expired,
 * or the session does not have the 'admin' role.
 */
export async function getAdminSession(request?: Request): Promise<SessionPayload | null> {
  let token: string | undefined;

  // 1. Try Authorization header (common for API clients)
  if (request) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  // 2. Fallback to cookie
  if (!token) {
    token = await getCookie(ADMIN_SESSION_COOKIE_NAME);
  }

  if (!token) {
    return null;
  }

  const session = await verifySessionToken(token);
  if (!session || session.role !== 'admin') {
    logger.debug('[AdminSession] Invalid or non-admin session');
    return null;
  }
  return session;
}

/**
 * Get the authenticated rider's database ID.
 *
 * Priority:
 * 1. `x-rider-id` header (set by middleware from verified cookie — dev only)
 * 2. Direct cookie read (fallback when called outside middleware context)
 */
export async function getRiderId(request?: Request): Promise<string | null> {
  // Only trust headers in development (set by middleware from verified cookie)
  if (process.env.NODE_ENV !== 'production' && request) {
    const headerId = request.headers.get('x-rider-id');
    if (headerId) return headerId;
  }

  // Try from session cookie
  const session = await getSession();
  return session?.riderDbId ?? null;
}

/**
 * Get the authenticated rider's phone number.
 */
export async function getRiderPhone(request?: Request): Promise<string | null> {
  if (process.env.NODE_ENV !== 'production' && request) {
    const headerPhone = request.headers.get('x-rider-phone');
    if (headerPhone) return headerPhone;
  }

  const session = await getSession();
  return session?.phone ?? null;
}

/**
 * Get the authenticated admin's database ID.
 */
export async function getAdminId(request?: Request): Promise<string | null> {
  if (process.env.NODE_ENV !== 'production' && request) {
    const headerId = request.headers.get('x-admin-id');
    if (headerId) return headerId;
  }

  const session = await getAdminSession();
  return session?.adminId ?? session?.riderDbId ?? null;
}
