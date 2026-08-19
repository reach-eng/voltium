import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { bulkActionSchema, createPlanSchema, createRiderSchema, createVehicleSchema, sendOtpSchema, verifyOtpSchema } from './lib/validators';
import { env } from './lib/env';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
// PR-112 (SEC PR-5): use the canonical APP_ENV for the production gate that
// drives the strict CSP + HSTS. A misconfigured prod with APP_ENV=staging
// (and NODE_ENV=production) would otherwise ship dev CSP to staging.
const isProd =
  process.env.APP_ENV === 'production' ||
  process.env.APP_ENV === 'staging' ||
  process.env.NODE_ENV === 'production';

const VALIDATION_MAP: Record<string, Record<string, any>> = {
  '/api/auth/send-otp': { POST: sendOtpSchema },
  '/api/auth/verify-otp': { POST: verifyOtpSchema },
  '/api/admin/riders': { POST: createRiderSchema },
  '/api/admin/riders/bulk': { POST: bulkActionSchema },
  '/api/admin/plans': { POST: createPlanSchema },
  '/api/admin/vehicles': { POST: createVehicleSchema },
};

const getDevCsp = (nonce: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.googleapis.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.googleapis.com",
    "img-src 'self' data: https://placehold.co https://*.unsplash.com https://*.googleapis.com https://*.google.com https://*.gstatic.com blob:",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
    "connect-src 'self' http://localhost:* http://127.0.0.1:* https://api.voltium.app ws://localhost:* wss://localhost:* ws://127.0.0.1:* https://*.googleapis.com https://*.google.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

const getProdCsp = (nonce: string) =>
  [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://*.google.com https://*.googleapis.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.googleapis.com",
    "img-src 'self' data: https://placehold.co https://*.unsplash.com https://*.googleapis.com https://*.google.com https://*.gstatic.com blob:",
    "font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com",
    "connect-src 'self' https://api.voltium.app https://*.googleapis.com https://*.google.com",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');

function getSecurityHeaders(nonce: string): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    'Content-Security-Policy': isProd ? getProdCsp(nonce) : getDevCsp(nonce),
  };

  if (isProd) {
    headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload';
  }

  return headers;
}

function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method);
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

function rejectCsrf(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

import { ADMIN_SESSION_COOKIE_NAME } from './lib/auth';
// PR-3 (2026-08-06 fix plan): the maintenance cache moved to a shared
// module so the admin PUT route can invalidate it (see maintenance-cache.ts).
import { getMaintenanceState } from './lib/maintenance-cache';

export async function middleware(request: NextRequest) {
  // Bypass middleware for the Flutter web portal static files
  if (request.nextUrl.pathname.startsWith('/rider-app')) {
    return NextResponse.next();
  }

  // P0-1: Maintenance Mode Enforcement for rider traffic
  const pathname = request.nextUrl.pathname;
  if (
    (pathname.startsWith('/api/rider/') || pathname.startsWith('/api/auth/')) &&
    pathname !== '/api/rider/maintenance-status'
  ) {
    const isAdmin = request.cookies.has(ADMIN_SESSION_COOKIE_NAME);
    if (!isAdmin) {
      const maintenanceState = await getMaintenanceState();
      if (maintenanceState.enabled) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'MAINTENANCE_MODE',
              message: maintenanceState.message,
            },
          },
          { status: 503 }
        );
      }
    }
  }

  // Enforce schema validations on API endpoints before hitting DB/services
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const contentType = request.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const schema = VALIDATION_MAP[request.nextUrl.pathname]?.[request.method];
      if (schema) {
        try {
          const clonedRequest = request.clone();
          const body = await clonedRequest.json();
          const result = schema.safeParse(body);
          if (!result.success) {
            const firstError = result.error.issues[0];
            const fieldPath = firstError?.path.join('.');
            const errorMessage = fieldPath
              ? `${fieldPath}: ${firstError.message}`
              : firstError?.message || 'Validation failed';
            return NextResponse.json(
              {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: errorMessage,
                },
              },
              { status: 422 }
            );
          }
        } catch (err) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'BAD_REQUEST',
                message: 'Invalid JSON body',
              },
            },
            { status: 400 }
          );
        }
      }
    }
  }

  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const nonce = btoa(String.fromCharCode(...randomBytes)).replace(/[^a-zA-Z0-9]/g, '');
  const correlationId =
    request.headers.get('x-correlation-id') || crypto.randomUUID().replace(/-/g, '');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('x-correlation-id', correlationId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set('x-correlation-id', correlationId);
  response.headers.set('x-nonce', nonce);

  Object.entries(getSecurityHeaders(nonce)).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // ── CORS ────────────────────────────────────────────────────────────────
  const origin = request.headers.get('origin');
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) ?? [];
  const isLocalhost =
    origin &&
    (origin.startsWith('http://localhost:') ||
      origin.startsWith('http://127.0.0.1:') ||
      origin.startsWith('http://192.168.') ||
      origin.startsWith('http://10.'));

  // P1-S4: Restrict CORS origins strictly to ALLOWED_ORIGINS or localhost/local IP in dev
  if (origin && (allowedOrigins.includes(origin) || isLocalhost)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-correlation-id, Idempotency-Key, Api-Version, Accept, Origin, X-Requested-With');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
  }

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: response.headers });
  }

  // Skip CSRF for safe methods
  if (isSafeMethod(request.method)) {
    return response;
  }

  // Reject unsafe requests with null origin (sandboxed iframes, data: URIs, etc.)
  if (origin === 'null') {
    return rejectCsrf('CSRF validation failed: null origin not allowed');
  }

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const host = request.headers.get('host');
      const isLocalhostOrigin =
        originHost.startsWith('localhost:') ||
        originHost === 'localhost' ||
        originHost.startsWith('127.0.0.1') ||
        originHost.startsWith('192.168.') ||
        originHost.startsWith('10.');
      if (host && originHost !== host && !allowedOrigins.includes(origin) && !isLocalhostOrigin) {
        return rejectCsrf('CSRF validation failed: origin mismatch');
      }
    } catch {
      return rejectCsrf('CSRF validation failed: invalid origin');
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|rider-app|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
