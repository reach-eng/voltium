/**
 * Tests for withErrorHandler — typed ApiError path.
 *
 * When a use-case throws an ApiError subclass (NotFoundError, AuthError, etc.),
 * the handler should propagate the status code + structured body instead of
 * returning a generic 500.
 *
 * Audit ref: AUDIT_BACKEND.md cross-cutting #4 (Ticket #62 follow-up)
 */

import { describe, it, expect, vi } from 'vitest';
import { NotFoundError, AuthError, ValidationError, ApiError, ERROR_CODES } from '@/lib/api-error';

function mockRequest(): any {
  return {
    nextUrl: { pathname: '/api/test' },
    method: 'POST',
  };
}

describe('withErrorHandler — typed ApiError path', () => {
  async function getHandler() {
    const mod = await import('@/lib/api-middleware');
    return mod.withErrorHandler;
  }

  it('returns 404 + structured body for NotFoundError', async () => {
    const withErrorHandler = await getHandler();
    const handler = withErrorHandler(async () => {
      throw new NotFoundError('rider');
    });
    const res = await handler(mockRequest() as any);

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.NOT_FOUND);
    expect(body.error.message).toMatch(/rider/);
  });

  it('returns 401 + structured body for AuthError', async () => {
    const withErrorHandler = await getHandler();
    const handler = withErrorHandler(async () => {
      throw new AuthError('Token expired');
    });
    const res = await handler(mockRequest() as any);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe(ERROR_CODES.UNAUTHORIZED);
    expect(body.error.message).toBe('Token expired');
  });

  it('returns 400 + structured body for ValidationError', async () => {
    const withErrorHandler = await getHandler();
    const handler = withErrorHandler(async () => {
      throw new ValidationError('Missing required field: phone');
    });
    const res = await handler(mockRequest() as any);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('returns 500 + structured body for plain ApiError (no specific subclass)', async () => {
    const withErrorHandler = await getHandler();
    const handler = withErrorHandler(async () => {
      throw new ApiError('Custom error', ERROR_CODES.SERVER_ERROR, 500);
    });
    const res = await handler(mockRequest() as any);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe(ERROR_CODES.SERVER_ERROR);
  });

  it('falls through to generic 500 for plain Error (backward compat)', async () => {
    const withErrorHandler = await getHandler();
    const handler = withErrorHandler(async () => {
      throw new Error('Some unexpected error');
    });
    const res = await handler(mockRequest() as any);

    // The legacy string-match + generic-500 path. Status 500 (or 502 if it
    // matched "fetch" by chance, but "Some unexpected error" doesn't).
    expect([500, 502]).toContain(res.status);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('preserves the error code in the response for typed errors', async () => {
    const withErrorHandler = await getHandler();
    const handler = withErrorHandler(async () => {
      throw new ApiError('Conflict', ERROR_CODES.CONFLICT, 409);
    });
    const res = await handler(mockRequest() as any);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe(ERROR_CODES.CONFLICT);
  });
});
