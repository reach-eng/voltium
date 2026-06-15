import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// Allowed origins for CORS — configure via ALLOWED_ORIGINS env var (comma-separated)

function getCorsOrigin(request: NextRequest): string | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  // In development, allow all localhost origins
  if (env.NODE_ENV === 'development' && origin.startsWith('http://localhost')) {
    return origin;
  }
  const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim());
  return allowedOrigins.includes(origin) ? origin : null;
}

export function proxy(request: NextRequest) {
  const startTime = Date.now();
  const { method, nextUrl } = request;

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0] ||
    request.headers.get('cf-connecting-ip') ||
    'unknown';

  const userAgent = request.headers.get('user-agent') || 'unknown';
  const requestId = crypto.randomUUID();

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    const corsOrigin = getCorsOrigin(request);
    const preflightResponse = new NextResponse(null, { status: 204 });
    if (corsOrigin) {
      preflightResponse.headers.set('Access-Control-Allow-Origin', corsOrigin);
      preflightResponse.headers.set(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      );
      preflightResponse.headers.set(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, x-rider-id, x-admin-id'
      );
      preflightResponse.headers.set('Access-Control-Max-Age', '86400');
    }
    return preflightResponse;
  }

  const response = NextResponse.next();

  response.headers.set('x-request-id', requestId);
  response.headers.set('x-response-time', String(Date.now() - startTime));

  // Set CORS origin only if the request origin is allowed
  const corsOrigin = getCorsOrigin(request);
  if (corsOrigin) {
    response.headers.set('Access-Control-Allow-Origin', corsOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, x-rider-id, x-admin-id'
    );
  }

  logger.debug('[Request]', {
    requestId,
    method,
    path: nextUrl.pathname,
    ip: ip.substring(0, 50),
    userAgent: userAgent.substring(0, 100),
  });

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
