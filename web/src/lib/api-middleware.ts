import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { checkIdempotency, saveIdempotency } from '@/lib/idempotency';

const MAX_REQUEST_SIZE = 1024 * 1024;

export function withIdempotency(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const key = req.headers.get('x-idempotency-key');
    if (!key || req.method !== 'POST') {
      return handler(req);
    }

    const cached = await checkIdempotency(key);
    if (cached) {
      logger.info('[Idempotency] Serving cached response', { key, path: req.nextUrl.pathname });
      return NextResponse.json(cached);
    }

    const response = await handler(req);
    if (response.status >= 200 && response.status < 300) {
      try {
        const cloned = response.clone();
        const json = await cloned.json();
        await saveIdempotency(key, json);
      } catch (err) {
        logger.error('[Idempotency] Failed to cache response:', err);
      }
    }

    return response;
  };
}

export async function withRequestSizeLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  maxSizeBytes: number = MAX_REQUEST_SIZE
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const contentLength = req.headers.get('content-length');

    if (contentLength && parseInt(contentLength) > maxSizeBytes) {
      logger.warn('[Request Size Limit]', {
        size: contentLength,
        max: maxSizeBytes,
        path: req.nextUrl.pathname,
      });

      return NextResponse.json({ success: false, error: 'Request too large' }, { status: 413 });
    }

    return handler(req);
  };
}

export async function withErrorHandler(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(req);
    } catch (error) {
      logger.error('[API Error]', {
        path: req.nextUrl.pathname,
        method: req.method,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
  };
}

export async function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  maxRequests: number,
  windowMs: number
) {
  const wrappedHandler = async (req: NextRequest): Promise<NextResponse> => {
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      'unknown';

    const rl = await checkRateLimit(`api:${req.nextUrl.pathname}:${clientIp}`, {
      windowMs,
      maxRequests,
    });

    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': String(rl.remaining),
            'X-RateLimit-Reset': String(rl.resetAt),
          },
        }
      );
    }

    return handler(req);
  };

  return withErrorHandler(wrappedHandler);
}
