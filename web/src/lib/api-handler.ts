import { NextRequest, NextResponse } from 'next/server';
import { ApiError, ERROR_CODES } from './api-error';
import { errors } from './api-response';
import { logger } from './logger';

export function withApiHandler(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: any[]) => {
    try {
      return await handler(request, ...args);
    } catch (err: any) {
      logger.error('[ApiHandler] Unhandled route error', {
        path: request.nextUrl.pathname,
        message: err.message,
        stack: err.stack,
      });

      if (err instanceof ApiError) {
        const code = err.code;
        if (code === ERROR_CODES.UNAUTHORIZED) return errors.unauthorized(err.message);
        if (code === ERROR_CODES.FORBIDDEN) return errors.forbidden(err.message);
        if (code === ERROR_CODES.NOT_FOUND) return errors.notFound(err.message);
        if (code === ERROR_CODES.VALIDATION_ERROR) return errors.validation(err.message);
        if (code === ERROR_CODES.CONFLICT) return errors.conflict(err.message);
        if (code === ERROR_CODES.RATE_LIMITED) return errors.tooManyRequests(err.message);
        if (code === ERROR_CODES.GONE) return errors.gone(err.message);
        return errors.badRequest(err.message);
      }

      // Handle domain-specific exceptions by naming convention
      if (err.name === 'RentalBookError') {
        const code = err.code;
        if (code === 'NOT_FOUND') return errors.notFound(err.message);
        if (code === 'CONFLICT') return errors.conflict(err.message);
        return errors.badRequest(err.message);
      }

      if (
        err.name === 'KycStateError' ||
        err.name === 'GuarantorStateError' ||
        err.name === 'DepositStateMachineError' ||
        err.name === 'RentalStateError'
      ) {
        return errors.conflict(err.message);
      }

      if (err.message?.includes('not found') || err.message?.includes('Not found')) {
        return errors.notFound(err.message);
      }

      return errors.internal(err.message || 'Internal Server Error');
    }
  };
}
