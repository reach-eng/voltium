import { NextRequest, NextResponse } from 'next/server';
import { ApiError, ERROR_CODES } from './api-error';
import { errors } from './api-response';
import { logger } from './logger';
import { redactPii } from './pii-redact';
import { RentalBookError } from '@/server/modules/rentals/use-cases/errors';
import { RentalStateError } from '@/server/modules/rentals/rental-state-machine';
import { KycStateError } from '@/server/modules/kyc/kyc-state-machine';
import { GuarantorStateError } from '@/server/modules/guarantors/guarantor-state-machine';
import { DepositStateMachineError } from '@/server/modules/deposits/deposit-state-machine';

type DomainError = Error & { code?: string };

function asDomainError(err: unknown): DomainError {
  return err instanceof Error ? err : new Error(String(err));
}

export function withApiHandler(
  handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (request: NextRequest, ...args: any[]) => {
    try {
      const response = await handler(request, ...args);

      // Automatic HTTP 304 Not Modified evaluation for GET requests
      if (request.method === 'GET' && response.status === 200) {
        const ifNoneMatch = request.headers.get('if-none-match');
        const etag = response.headers.get('etag');

        if (
          etag &&
          ifNoneMatch &&
          (ifNoneMatch === etag || ifNoneMatch === `W/${etag}` || `W/${ifNoneMatch}` === etag)
        ) {
          const headers = new Headers(response.headers);
          return new NextResponse(null, {
            status: 304,
            headers,
          });
        }
      }

      return response;
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

      // Prisma P2025 "record not found"
      if ((err as any)?.code === 'P2025') {
        return errors.notFound(domainErr.message);
      }

      // Domain-specific exceptions. We use `instanceof` against the actual
      // error classes — the previous `.name === 'X'` check silently failed
      // under any minifier that mangled class names (esbuild `--minify-identifiers`,
      // production Next.js builds). The classes themselves still work; we just
      // can't rely on the string label matching the minified identifier.
      if (err instanceof RentalBookError) {
        const code = (err as DomainError).code;
        if (code === 'NOT_FOUND') return errors.notFound(domainErr.message);
        if (code === 'CONFLICT') return errors.conflict(domainErr.message);
        return errors.badRequest(domainErr.message);
      }

      if (
        err instanceof KycStateError ||
        err instanceof GuarantorStateError ||
        err instanceof DepositStateMachineError ||
        err instanceof RentalStateError
      ) {
        return errors.conflict(domainErr.message);
      }

      return errors.internal(domainErr.message || 'Internal Server Error');
    }
  };
}
