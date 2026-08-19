import { cookies } from 'next/headers';
import {
  verifySessionToken,
  type SessionPayload,
  SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
} from './auth';
import { logger } from './logger';

async function getCookie(name: string): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(name)?.value;
  } catch {
    return undefined;
  }
}

const REQUEST_SESSION_CACHE = new WeakMap<Request, Promise<SessionPayload | null>>();

/**
 * Get the current session from the `voltium-session` cookie or Authorization header.
 *
 * Returns `null` if no session exists or the token is invalid/expired.
 * Request-scoped memoization prevents duplicate JWT verification calls in the same request.
 */
export async function getSession(request?: Request): Promise<SessionPayload | null> {
  if (request && REQUEST_SESSION_CACHE.has(request)) {
    return REQUEST_SESSION_CACHE.get(request)!;
  }

  const promise = (async () => {
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
  })();

  if (request) {
    REQUEST_SESSION_CACHE.set(request, promise);
  }

  return promise;
}

const REQUEST_ADMIN_SESSION_CACHE = new WeakMap<Request, Promise<SessionPayload | null>>();

/**
 * Get the admin session from cookie or Authorization header.
 *
 * Returns `null` if no session exists, the token is invalid/expired,
 * or the session does not have the 'admin' role.
 * Request-scoped memoization prevents duplicate JWT verification calls in the same request.
 */
export async function getAdminSession(request?: Request): Promise<SessionPayload | null> {
  if (request && REQUEST_ADMIN_SESSION_CACHE.has(request)) {
    return REQUEST_ADMIN_SESSION_CACHE.get(request)!;
  }

  const promise = (async () => {
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
  })();

  if (request) {
    REQUEST_ADMIN_SESSION_CACHE.set(request, promise);
  }

  return promise;
}

/**
 * Get the authenticated rider's database ID.
 *
 * Priority:
 * 1. `x-rider-id` header (set by middleware from verified cookie — dev only)
 * 2. Direct cookie read (fallback when called outside middleware context)
 */
export async function getRiderId(request?: Request): Promise<string | null> {
  // Only trust headers in non-production envs (set by middleware from
  // verified cookie). Use APP_ENV (the canonical "where am I" env var)
  // rather than NODE_ENV (the Next.js optimization flag) — a staging
  // deploy with NODE_ENV=development for hot-reload would otherwise
  // trust the impersonation header in prod-like traffic.
  if (process.env.APP_ENV !== 'production' && request) {
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
  if (process.env.APP_ENV !== 'production' && request) {
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
  if (process.env.APP_ENV !== 'production' && request) {
    try {
      const url = new URL(request.url);
      // P2-20: EXACT path match only. The old `pathname.includes('/impersonate')`
      // substring check let a request to any path containing the word (e.g.
      // /api/admin/impersonate-test) spoof an admin id via x-admin-id.
      if (url.pathname === '/api/admin/impersonate') {
        const headerId = request.headers.get('x-admin-id');
        if (headerId) return headerId;
      }
    } catch {
      // invalid URL, ignore header
    }
  }

  const session = await getAdminSession(request);
  return session?.adminId ?? session?.riderDbId ?? null;
}
