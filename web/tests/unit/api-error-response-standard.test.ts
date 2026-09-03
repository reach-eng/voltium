import { describe, it, expect } from 'vitest';
import {
  ERROR_CODES,
  ApiError,
  BadRequestError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  RateLimitError,
  GoneError,
  ServiceUnavailableError,
  ServerError,
  normalizeError,
  isApiError,
  getErrorCode,
} from '@/lib/api-error';
import { handleApiError, normalizeApiResponse } from '@/lib/api-response';

describe('Standardized API Error & Response Shape', () => {
  it('instantiates all error subclasses with correct codes and status codes', () => {
    expect(new BadRequestError('Bad payload')).toMatchObject({
      code: ERROR_CODES.BAD_REQUEST,
      status: 400,
      message: 'Bad payload',
    });

    expect(new AuthError()).toMatchObject({
      code: ERROR_CODES.UNAUTHORIZED,
      status: 401,
      message: 'Authentication required',
    });

    expect(new ForbiddenError()).toMatchObject({
      code: ERROR_CODES.FORBIDDEN,
      status: 403,
      message: 'Access denied',
    });

    expect(new NotFoundError('Rider')).toMatchObject({
      code: ERROR_CODES.NOT_FOUND,
      status: 404,
      message: 'Rider not found',
    });

    expect(new ValidationError('Invalid email', { field: 'email' })).toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
      status: 422,
      message: 'Invalid email',
      details: { field: 'email' },
    });

    expect(new ConflictError('Email in use')).toMatchObject({
      code: ERROR_CODES.CONFLICT,
      status: 409,
      message: 'Email in use',
    });

    expect(new RateLimitError()).toMatchObject({
      code: ERROR_CODES.RATE_LIMITED,
      status: 429,
      message: 'Too many requests',
    });

    expect(new GoneError()).toMatchObject({
      code: ERROR_CODES.GONE,
      status: 410,
    });

    expect(new ServiceUnavailableError()).toMatchObject({
      code: ERROR_CODES.SERVICE_UNAVAILABLE,
      status: 503,
    });

    expect(new ServerError()).toMatchObject({
      code: ERROR_CODES.SERVER_ERROR,
      status: 500,
    });
  });

  it('identifies ApiError instances and extracts error codes', () => {
    const err = new NotFoundError('Hub');
    expect(isApiError(err)).toBe(true);
    expect(getErrorCode(err)).toBe(ERROR_CODES.NOT_FOUND);

    const genericErr = new Error('Random error');
    expect(isApiError(genericErr)).toBe(false);
    expect(getErrorCode(genericErr)).toBe(ERROR_CODES.SERVER_ERROR);
  });

  it('normalizeError formats various error types into canonical NormalizedErrorPayload', () => {
    const apiErr = new ConflictError('Duplicate key', { key: 'phone' });
    expect(normalizeError(apiErr)).toEqual({
      code: ERROR_CODES.CONFLICT,
      message: 'Duplicate key',
      status: 409,
      details: { key: 'phone' },
    });

    const zodErr = new Error('Validation failed');
    zodErr.name = 'ZodError';
    (zodErr as any).issues = [{ path: ['amount'], message: 'Must be positive' }];
    expect(normalizeError(zodErr)).toEqual({
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Validation failed',
      status: 422,
      details: [{ path: ['amount'], message: 'Must be positive' }],
    });

    const plainErr = new Error('Database connection lost');
    expect(normalizeError(plainErr)).toEqual({
      code: ERROR_CODES.SERVER_ERROR,
      message: 'Database connection lost',
      status: 500,
    });

    expect(normalizeError('String error')).toEqual({
      code: ERROR_CODES.SERVER_ERROR,
      message: 'String error',
      status: 500,
    });
  });

  it('handleApiError converts error into standard NextResponse with uniform JSON envelope', async () => {
    const notFound = new NotFoundError('Vehicle');
    const response = handleApiError(notFound, { correlationId: 'req-123' });

    expect(response.status).toBe(404);
    expect(response.headers.get('X-Correlation-ID')).toBe('req-123');

    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      error: {
        code: ERROR_CODES.NOT_FOUND,
        message: 'Vehicle not found',
      },
      meta: {
        correlationId: 'req-123',
      },
    });
    expect(body.meta.timestamp).toBeDefined();
  });

  it('normalizeApiResponse handles both success and error objects', () => {
    const normalizedSuccess = normalizeApiResponse({ success: true, data: { id: '123' } });
    expect(normalizedSuccess.success).toBe(true);
    if (normalizedSuccess.success) {
      expect(normalizedSuccess.data).toEqual({ id: '123' });
    }

    const normalizedError = normalizeApiResponse({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Not found' },
    });
    expect(normalizedError.success).toBe(false);
    if (!normalizedError.success) {
      expect((normalizedError as any).error.code).toBe('NOT_FOUND');
    }
  });
});
