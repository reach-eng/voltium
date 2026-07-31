import { NextRequest, NextResponse } from 'next/server';
import { ApiError, ERROR_CODES } from './api-error';
import { errors } from './api-response';
import { logger } from './logger';
import { redactPii } from './pii-redact';
import { DomainError } from './domain-error';

export function withApiHandler(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: any[]) => {
    try {
      return await handler(request, ...args);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;

      logger.error('[ApiHandler] Unhandled route error', redactPii({
        path: request.nextUrl.pathname,
        message,
        stack,
      }));

      // ApiError — use the error code to pick the right HTTP status
      if (err instanceof ApiError) {
        const code = err.code;
        if (code === ERROR_CODES.UNAUTHORIZED) return errors.unauthorized(message);
        if (code === ERROR_CODES.FORBIDDEN) return errors.forbidden(message);
        if (code === ERROR_CODES.NOT_FOUND) return errors.notFound(message);
        if (code === ERROR_CODES.VALIDATION_ERROR) return errors.validation(message);
        if (code === ERROR_CODES.CONFLICT) return errors.conflict(message);
        if (code === ERROR_CODES.RATE_LIMITED) return errors.tooManyRequests(message);
        if (code === ERROR_CODES.GONE) return errors.gone(message);
        return errors.badRequest(message);
      }

      // Domain-specific exceptions via DomainError base class
      if (err instanceof DomainError) {
        if (err.httpStatus === 404) return errors.notFound(message);
        if (err.httpStatus === 409) return errors.conflict(message);
        if (err.httpStatus === 403) return errors.forbidden(message);
        if (err.httpStatus === 401) return errors.unauthorized(message);
        if (err.httpStatus === 422) return errors.validation(message);
        return errors.badRequest(message);
      }

      // Prisma "record not found" — typed error, not a string match.
      // The Prisma client uses error code 'P2025' for `findUnique` / `findFirst`
      // misses. We treat it as 404 at the route boundary instead of leaking
      // a 500.
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: unknown }).code === 'P2025'
      ) {
        return errors.notFound(message || 'Resource not found');
      }

      return errors.internal(message || 'Internal Server Error');
    }
  };
}
