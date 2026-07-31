import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  sendOtpSchema,
  verifyOtpSchema,
  submitKycSchema,
  submitGuarantorSchema,
  createRiderSchema,
  bulkActionSchema,
  createPlanSchema,
  createVehicleSchema,
} from './lib/validators';
import { env } from './lib/env';
import { getSecurityHeaders } from './lib/csp';
import { handleCors } from './lib/cors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const isProd = env.APP_ENV === 'production';

const VALIDATION_MAP: Record<string, Record<string, any>> = {
  '/api/auth/send-otp': { POST: sendOtpSchema },
  '/api/auth/verify-otp': { POST: verifyOtpSchema },
  '/api/rider/kyc': { POST: submitKycSchema },
  '/api/rider/guarantor': { POST: submitGuarantorSchema },
  '/api/admin/riders': { POST: createRiderSchema },
  '/api/admin/riders/bulk': { POST: bulkActionSchema },
  '/api/admin/plans': { POST: createPlanSchema },
  '/api/admin/vehicles': { POST: createVehicleSchema },
};

function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method);
}

function getClientIp(request: NextRequest): string {
  const reqAny = request as any;
  if (env.TRUST_PROXY_HEADERS) {
    return (
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      reqAny.ip ||
      'unknown'
    );
  }
  return reqAny.ip || 'unknown';
}

function rejectCsrf(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function middleware(request: NextRequest) {
  // Bypass middleware for the Flutter web portal static files
  if (request.nextUrl.pathname.startsWith('/rider-app')) {
    return NextResponse.next();
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
  const corsResponse = handleCors(request, response);
  if (corsResponse) {
    return corsResponse;
  }

  // Skip CSRF for safe methods
  if (isSafeMethod(request.method)) {
    return response;
  }

  // Reject unsafe requests with null origin (sandboxed iframes, data: URIs, etc.)
  const origin = request.headers.get('origin');
  const allowedOrigins = env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()) ?? [];
  if (origin === 'null') {
    return rejectCsrf('CSRF validation failed: null origin not allowed');
  }

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const host = request.headers.get('host');
      const isLocalhostOrigin = originHost.startsWith('localhost:') || originHost === 'localhost';
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

