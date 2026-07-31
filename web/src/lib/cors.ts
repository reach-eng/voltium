import { NextResponse, NextRequest } from 'next/server';
import { env } from './env';

const isProd = env.APP_ENV === 'production';

export function handleCors(request: NextRequest, response: NextResponse): NextResponse | null {
  const origin = request.headers.get('origin');
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) ?? [];
  const allowedDevPorts = new Set(['8081', '3000', '8080', '5173', '5554']);
  const isValidDevLocalhost = (() => {
    if (!origin || isProd) return false;
    try {
      const parsed = new URL(origin);
      const isLocalHostName = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      return isLocalHostName && allowedDevPorts.has(parsed.port);
    } catch {
      return false;
    }
  })();

  if (origin && (allowedOrigins.includes(origin) || isValidDevLocalhost)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-correlation-id, Idempotency-Key, Api-Version, Accept, Origin, X-Requested-With');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');
  }

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: response.headers });
  }

  return null;
}
