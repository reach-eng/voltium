import { NextRequest, NextResponse } from 'next/server';
import { ApiError, ERROR_CODES } from './api-error';
import { errors } from './api-response';
import { logger } from './logger';
import { redactPii } from './pii-redact';

type DomainError = Error & { code?: string };

function asDomainError(err: unknown): DomainError {
  return err instanceof Error ? err : new Error(String(err));
}

export function withApiHandler(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: any[]) => {
    try {
      return await handler(request, ...args);
    } catch (err: unknown) {
      const domainErr = asDomainError(err);
      logger.error('[ApiHandler] Unhandled route error', redactPii({
        path: request.nextUrl.pathname,
        message: domainErr.message,
        stack: domainErr.stack,
      }));

      if (err instanceof ApiError) {
        const code = err.code;
        if (code === ERROR_CODES.UNAUTHORIZED) return errors.unauthorized((err instanceof Error ? err.message : String(err)));
        if (code === ERROR_CODES.FORBIDDEN) return errors.forbidden((err instanceof Error ? err.message : String(err)));
        if (code === ERROR_CODES.NOT_FOUND) return errors.notFound((err instanceof Error ? err.message : String(err)));
        if (code === ERROR_CODES.VALIDATION_ERROR) return errors.validation((err instanceof Error ? err.message : String(err)));
        if (code === ERROR_CODES.CONFLICT) return errors.conflict((err instanceof Error ? err.message : String(err)));
        if (code === ERROR_CODES.RATE_LIMITED) return errors.tooManyRequests((err instanceof Error ? err.message : String(err)));
        if (code === ERROR_CODES.GONE) return errors.gone((err instanceof Error ? err.message : String(err)));
        return errors.badRequest((err instanceof Error ? err.message : String(err)));
      }

      // Handle domain-specific exceptions by naming convention
      if (domainErr.name === 'RentalBookError') {
        const code = domainErr.code;
        if (code === 'NOT_FOUND') return errors.notFound(domainErr.message);
        if (code === 'CONFLICT') return errors.conflict(domainErr.message);
        return errors.badRequest(domainErr.message);
      }

      if (
        domainErr.name === 'KycStateError' ||
        domainErr.name === 'GuarantorStateError' ||
        domainErr.name === 'DepositStateMachineError' ||
        domainErr.name === 'RentalStateError'
      ) {
        return errors.conflict(domainErr.message);
      }

      if (domainErr.message.includes('not found') || domainErr.message.includes('Not found')) {
        return errors.notFound(domainErr.message);
      }

      return errors.internal(domainErr.message || 'Internal Server Error');
    }
  };
}
