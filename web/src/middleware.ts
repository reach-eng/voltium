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

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const isProd = process.env.NODE_ENV === 'production';

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

const DEV_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.unsplash.com https://*.googleapis.com blob:",
  "font-src 'self' data:",
  "connect-src 'self' http://localhost:* https://api.voltium.app ws://localhost:* wss://localhost:*",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.unsplash.com https://*.googleapis.com blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://api.voltium.app",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

function getSecurityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
    'Content-Security-Policy': isProd ? PROD_CSP : DEV_CSP,
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

export async function middleware(request: NextRequest) {
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
            return NextResponse.json({ success: false, error: errorMessage }, { status: 422 });
          }
        } catch (err) {
          return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
        }
      }
    }
  }

  const response = NextResponse.next();
  const correlationId =
    request.headers.get('x-correlation-id') || crypto.randomUUID().replace(/-/g, '');
  response.headers.set('x-correlation-id', correlationId);

  Object.entries(getSecurityHeaders()).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Skip CSRF for safe methods
  if (isSafeMethod(request.method)) {
    return response;
  }

  const origin = request.headers.get('origin');

  // Reject unsafe requests with null origin (sandboxed iframes, data: URIs, etc.)
  if (origin === 'null') {
    return rejectCsrf('CSRF validation failed: null origin not allowed');
  }

  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const host = request.headers.get('host');
      if (host && originHost !== host) {
        return rejectCsrf('CSRF validation failed: origin mismatch');
      }
    } catch {
      return rejectCsrf('CSRF validation failed: invalid origin');
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
