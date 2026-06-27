import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitIdentifierFromRequest } from '@/lib/rate-limit-middleware';
import { redactPii } from '@/lib/pii-redact';
import {
  checkOrClaimIdempotency,
  completeIdempotency,
  failIdempotency,
} from '@/lib/idempotency';

const MAX_REQUEST_SIZE = 1024 * 1024;

export function withIdempotency(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const key = req.headers.get('x-idempotency-key');
    if (!key || req.method !== 'POST') {
      return handler(req);
    }

    // Atomic check-and-claim
    const result = await checkOrClaimIdempotency(key);

    switch (result.status) {
      case 'completed':
        logger.info('[Idempotency] Serving cached response', { key, path: req.nextUrl.pathname });
        return NextResponse.json(result.response);

      case 'processing':
        logger.info('[Idempotency] Request already in-flight', { key, path: req.nextUrl.pathname });
        return NextResponse.json(
          {
            success: false,
            error: 'A request with this idempotency key is already being processed',
          },
          { status: 409 }
        );

      case 'not_found':
        // Proceed — we're the first to claim this key
        break;
    }

    // Execute the handler
    const response = await handler(req);

    // On success, mark key as completed with the response
    if (response.status >= 200 && response.status < 300) {
      try {
        const cloned = response.clone();
        const json = await cloned.json();
        await completeIdempotency(key, json);
      } catch (err) {
        logger.error('[Idempotency] Failed to cache response:', err);
      }
    } else if (response.status >= 500) {
      // Server error — allow retry by marking as failed
      await failIdempotency(key).catch(() => {});
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
      // Redact PII from error data before logging to prevent credential leaks
      const errorInfo: Record<string, unknown> = {
        path: req.nextUrl.pathname,
        method: req.method,
        error: error instanceof Error ? { name: error.name, message: error.message } : String(error),
      };
      // Include stack trace in development for debugging
      if (process.env.NODE_ENV !== 'production' && error instanceof Error && error.stack) {
        errorInfo.stack = error.stack;
      }
      logger.error('[API Error]', redactPii(errorInfo));

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
    const clientIp = rateLimitIdentifierFromRequest(req).replace(/^ip:/, '');

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
