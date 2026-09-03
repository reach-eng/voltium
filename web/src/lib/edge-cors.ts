/**
 * Edge-safe CORS + CSRF helpers. P1 split from `src/middleware.ts`.
 *
 * Edge-safe: no Node-only imports (no db, logger, jose). Reads
 * ALLOWED_ORIGINS directly from process.env to guarantee no transitive
 * Node-only modules in the Edge bundle.
 */
import { NextResponse } from 'next/server';

export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method);
}

export function rejectCsrf(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

function getAllowedOrigins(): string[] {
  return process.env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) ?? [];
}

function isDev(): boolean {
  return (
    process.env.APP_ENV === 'development' ||
    (process.env.APP_ENV !== 'production' &&
      process.env.APP_ENV !== 'staging' &&
      process.env.NODE_ENV === 'development')
  );
}

export function isLocalhostOrigin(origin: string | null): boolean {
  return (
    isDev() &&
    !!origin &&
    (origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.startsWith('http://192.168.') ||
      origin.startsWith('http://10.'))
  );
}

function isLocalhostHost(host: string): boolean {
  return (
    isDev() &&
    (host.startsWith('localhost:') ||
      host === 'localhost' ||
      host.startsWith('127.0.0.1') ||
      host.startsWith('192.168.') ||
      host.startsWith('10.'))
  );
}

/** Applies CORS headers for allowed origins. Mutates `response`. */
export function applyEdgeCors(response: NextResponse, origin: string | null): void {
  const allowedOrigins = getAllowedOrigins();
  // P1-S4: strictly ALLOWED_ORIGINS or localhost/local IP in dev.
  if (origin && (allowedOrigins.includes(origin) || isLocalhostOrigin(origin))) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-correlation-id, Idempotency-Key, Api-Version, Accept, Origin, X-Requested-With'
    );
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
  }
}

/**
 * Validates origin for unsafe methods. Returns a 403 rejection or null
 * when the request may proceed.
 */
export function checkEdgeCsrf(origin: string | null, host: string | null): NextResponse | null {
  if (origin === 'null') {
    return rejectCsrf('CSRF validation failed: null origin not allowed');
  }
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const allowedOrigins = getAllowedOrigins();
      if (
        host &&
        originHost !== host &&
        !allowedOrigins.includes(origin) &&
        !isLocalhostHost(originHost)
      ) {
        return rejectCsrf('CSRF validation failed: origin mismatch');
      }
    } catch {
      return rejectCsrf('CSRF validation failed: invalid origin');
    }
  }
  return null;
}
