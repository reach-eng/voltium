import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
// P0+P1 Edge-safety: this file runs on the Edge runtime. It must NOT import
// Node-only modules transitively (Prisma via ./lib/db, pino via
// ./lib/logger, jose via ./lib/auth, Zod schemas via ./lib/validators).
// All helpers below live in Edge-safe lib/* modules with zero Node imports.
import { getEdgeMaintenanceState } from './lib/maintenance-edge';
import { getEdgeSecurityHeaders } from './lib/edge-security';
import { applyEdgeCors, checkEdgeCsrf, isSafeMethod } from './lib/edge-cors';
import { guardEdgeJsonBody } from './lib/edge-json-guard';

// Cookie name duplicated from lib/auth.ts to avoid importing the Node-only
// auth module (jose + db) into the Edge bundle. Keep in sync.
const ADMIN_SESSION_COOKIE_NAME = 'voltium-admin-session';

export async function middleware(request: NextRequest) {
  // Bypass middleware for the Flutter web portal static files
  if (request.nextUrl.pathname.startsWith('/rider-app')) {
    return NextResponse.next();
  }

  // P0-1: Maintenance Mode Enforcement for rider traffic
  const pathname = request.nextUrl.pathname;

  // API Version Validation
  if (pathname.startsWith('/api/')) {
    const pathMatch = pathname.match(/^\/api\/(v\d+)\//);
    if (pathMatch && pathMatch[1] !== 'v1') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNSUPPORTED_API_VERSION',
            message: `API version ${pathMatch[1]} is not supported`,
          },
        },
        { status: 400 }
      );
    }
  }
  if (
    (pathname.startsWith('/api/rider/') || pathname.startsWith('/api/auth/')) &&
    pathname !== '/api/rider/maintenance-status'
  ) {
    const isAdmin = request.cookies.has(ADMIN_SESSION_COOKIE_NAME);
    if (!isAdmin) {
      const maintenanceState = await getEdgeMaintenanceState(request.url);
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

  // Parse-only JSON guard (full Zod per-route in Node).
  const jsonRejection = await guardEdgeJsonBody(request);
  if (jsonRejection) return jsonRejection;

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

  Object.entries(getEdgeSecurityHeaders(nonce)).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  if (pathname.startsWith('/api/')) {
    response.headers.set('Api-Version', 'v1');
    response.headers.set('X-Api-Version', '1.0.0');
  }

  // ── CORS ────────────────────────────────────────────────────────────────
  const origin = request.headers.get('origin');
  applyEdgeCors(response, origin);

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: response.headers });
  }

  // Skip CSRF for safe methods
  if (isSafeMethod(request.method)) {
    return response;
  }

  const csrfRejection = checkEdgeCsrf(origin, request.headers.get('host'));
  if (csrfRejection) return csrfRejection;

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|rider-app|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
