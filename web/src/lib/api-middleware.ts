import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkRateLimit } from '@/lib/rate-limit';
import { rateLimitIdentifierFromRequest } from '@/lib/rate-limit-middleware';
import { redactPii } from '@/lib/pii-redact';
import { isProductionEnv } from '@/lib/env';
import {
  checkOrClaimIdempotency,
  completeIdempotency,
  failIdempotency,
} from '@/lib/idempotency';

/**
 * Middleware Chain Execution Order:
 * 1. withErrorHandler: Top-level try-catch, converts unhandled exceptions to structured JSON responses (5xx/4xx).
 * 2. withRequestSizeLimit: Rejects payloads larger than MAX_REQUEST_SIZE (1MB default) early (413).
 * 3. withRateLimit: Checks IP rate limits and returns 429 if exceeded.
 * 4. withIdempotency: Prevents duplicate mutations for POST/PUT/PATCH/DELETE requests carrying `x-idempotency-key` (409/200-cached).
 * 5. Route Handler: Executes domain logic and returns NextResponse.
 */

const MAX_REQUEST_SIZE = 1024 * 1024;

export function validateContentType(req: NextRequest, allowedTypes = ['application/json']): NextResponse | null {
  if (['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType || !allowedTypes.some(t => contentType.toLowerCase().includes(t))) {
      return NextResponse.json(
        { success: false, error: `Unsupported Media Type: expected ${allowedTypes.join(', ')}` },
        { status: 415 }
      );
    }
  }
  return null;
}

export function withIdempotency(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const key = req.headers.get('x-idempotency-key');
    const allowedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (!key || !allowedMethods.includes(req.method.toUpperCase())) {
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
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const cloned = response.clone();
          const json = await cloned.json();
          await completeIdempotency(key, json);
        }
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

export function withErrorHandler(handler: (req: NextRequest) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      return await handler(req);
    } catch (error) {
      // Typed error path: ApiError instances carry their own status + code.
      // Use-case throws `throw new NotFoundError('rider')` → 404 with structured body.
      // This is the right pattern; the legacy string-matching below is kept as a
      // fallback for use-cases that still throw plain `new Error('Not found')`.
      if (error && typeof error === 'object' && 'code' in error && 'status' in error) {
        const apiErr = error as { message?: string; code?: string; status?: number; name?: string };
        logger.error('[API Error — typed]', {
          path: req.nextUrl.pathname,
          method: req.method,
          code: apiErr.code,
          name: apiErr.name,
          message: apiErr.message,
        });
        return NextResponse.json(
          {
            success: false,
            error: {
              code: apiErr.code,
              message: apiErr.message,
            },
          },
          { status: apiErr.status ?? 500 }
        );
      }

      const message = error instanceof Error ? error.message : String(error);
      const errorInfo: Record<string, unknown> = {
        path: req.nextUrl.pathname,
        method: req.method,
        error: error instanceof Error ? { name: error.name, message } : String(error),
      };
      if (!isProductionEnv() && error instanceof Error && error.stack) {
        errorInfo.stack = error.stack;
      }
      logger.error('[API Error]', redactPii(errorInfo));

      // Differentiate 5xx responses by class so the client can decide
      // whether to retry, surface a banner, or escalate.
      //
      // - 502 (Bad Gateway): fetch failed at the upstream layer
      //   (browser fetch() throws TypeError; Node fetch is a real Error
      //   with cause).
      // - 503 (Service Unavailable): connection refused / reset — peer is
      //   down or restarting. Retry with backoff is the right call.
      // - 504 (Gateway Timeout): upstream didn't respond in time.
      // - 500 (default): anything else, including JS errors and DB
      //   failures. The exact message is intentionally hidden in
      //   production to avoid leaking internals; the correlation id and
      //   log are how the operator traces it.
      if (error instanceof TypeError && message.toLowerCase().includes('fetch')) {
        return NextResponse.json(
          { success: false, error: 'Upstream service unavailable' },
          { status: 502 }
        );
      }
      if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
        return NextResponse.json(
          { success: false, error: 'Request timed out' },
          { status: 504 }
        );
      }
      if (message.includes('ECONNREFUSED') || message.includes('ECONNRESET')) {
        return NextResponse.json(
          { success: false, error: 'Service temporarily unavailable' },
          { status: 503 }
        );
      }

      const isProd = isProductionEnv();
      return NextResponse.json(
        {
          success: false,
          error: isProd ? 'Internal server error' : (message || 'Internal server error'),
        },
        { status: 500 }
      );
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
