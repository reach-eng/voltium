/**
 * API Handler — Unit Tests
 *
 * Tests src/lib/api-handler.ts — withApiHandler error-wrapping HOF.
 *
 * Covers:
 *   - Successful handler passes through response
 *   - ApiError code mapping (UNAUTHORIZED, FORBIDDEN, NOT_FOUND, etc.)
 *   - Domain-specific error names (RentalBookError, KycStateError, etc.)
 *   - Message-based fallback ("not found")
 *   - Unknown errors → 500 Internal
 *   - Middleware integration flow
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock NextRequest (minimal shape needed by api-handler)
// ---------------------------------------------------------------------------

function mockRequest(pathname = '/api/test') {
  return {
    nextUrl: { pathname },
    headers: new Headers(),
    method: 'GET',
  } as any;
}

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/** Track the last response created by errors.* helpers */
let lastResponse: { status: number; body: any } = { status: 200, body: {} };

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((body: any, init?: { status?: number }) => {
      const status = init?.status ?? 200;
      lastResponse = { status, body };
      return { status, body, headers: new Headers() } as any;
    }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/api-response', () => ({
  errors: {
    unauthorized: vi.fn((msg: string) => {
      lastResponse = {
        status: 401,
        body: { success: false, error: { code: 'UNAUTHORIZED', message: msg } },
      };
      return lastResponse;
    }),
    forbidden: vi.fn((msg: string) => {
      lastResponse = {
        status: 403,
        body: { success: false, error: { code: 'FORBIDDEN', message: msg } },
      };
      return lastResponse;
    }),
    notFound: vi.fn((msg: string) => {
      lastResponse = {
        status: 404,
        body: { success: false, error: { code: 'NOT_FOUND', message: msg } },
      };
      return lastResponse;
    }),
    badRequest: vi.fn((msg: string) => {
      lastResponse = {
        status: 400,
        body: { success: false, error: { code: 'BAD_REQUEST', message: msg } },
      };
      return lastResponse;
    }),
    conflict: vi.fn((msg: string) => {
      lastResponse = {
        status: 409,
        body: { success: false, error: { code: 'CONFLICT', message: msg } },
      };
      return lastResponse;
    }),
    validation: vi.fn((msg: string) => {
      lastResponse = {
        status: 422,
        body: { success: false, error: { code: 'VALIDATION_ERROR', message: msg } },
      };
      return lastResponse;
    }),
    tooManyRequests: vi.fn((msg: string) => {
      lastResponse = {
        status: 429,
        body: { success: false, error: { code: 'RATE_LIMITED', message: msg } },
      };
      return lastResponse;
    }),
    gone: vi.fn((msg: string) => {
      lastResponse = {
        status: 410,
        body: { success: false, error: { code: 'GONE', message: msg } },
      };
      return lastResponse;
    }),
    internal: vi.fn((msg: string) => {
      lastResponse = {
        status: 500,
        body: { success: false, error: { code: 'SERVER_ERROR', message: msg } },
      };
      return lastResponse;
    }),
  },
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { withApiHandler } from '@/lib/api-handler';
import {
  ApiError,
  ERROR_CODES,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '@/lib/api-error';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function expectErrorResponse(
  handler: (req: any) => Promise<any>,
  expectedStatus: number,
  expectedCode?: string
) {
  const req = mockRequest();
  const response = await handler(req);
  expect(response.status).toBe(expectedStatus);
  if (expectedCode) {
    expect(response.body.error.code).toBe(expectedCode);
  }
  return response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('withApiHandler — success path', () => {
  beforeEach(() => vi.clearAllMocks());

  it('passes through the response when handler succeeds', async () => {
    const successResponse = {
      status: 200,
      body: { success: true, data: { id: 1 } },
      headers: new Headers(),
    };
    const handler = vi.fn().mockResolvedValue(successResponse);

    const wrapped = withApiHandler(handler);
    const req = mockRequest('/api/test');
    const result = await wrapped(req);

    expect(handler).toHaveBeenCalledWith(req);
    expect(result).toBe(successResponse);
  });

  it('passes additional args through to the handler', async () => {
    const successResponse = { status: 200, body: {}, headers: new Headers() };
    const handler = vi.fn().mockResolvedValue(successResponse);

    const wrapped = withApiHandler(handler);
    const req = mockRequest();
    const result = await wrapped(req, 'arg1', { key: 'val' });

    expect(handler).toHaveBeenCalledWith(req, 'arg1', { key: 'val' });
    expect(result).toBe(successResponse);
  });

  it('logs the route path on error', async () => {
    const { logger } = await import('@/lib/logger');
    const handler = vi.fn().mockRejectedValue(new Error('oops'));
    const wrapped = withApiHandler(handler);

    await wrapped(mockRequest('/api/rider/profile'));

    expect(logger.error).toHaveBeenCalledWith(
      '[ApiHandler] Unhandled route error',
      expect.objectContaining({ path: '/api/rider/profile' })
    );
  });
});

// ---------------------------------------------------------------------------
// ApiError code → HTTP response mapping
// ---------------------------------------------------------------------------

describe('withApiHandler — ApiError code mapping', () => {
  beforeEach(() => vi.clearAllMocks());

  it('UNAUTHORIZED → 401', async () => {
    const handler = vi.fn().mockRejectedValue(new AuthError('Please log in'));
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 401, 'UNAUTHORIZED');
  });

  it('FORBIDDEN → 403', async () => {
    const handler = vi.fn().mockRejectedValue(new ForbiddenError('Admin only'));
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 403, 'FORBIDDEN');
  });

  it('NOT_FOUND → 404', async () => {
    const handler = vi.fn().mockRejectedValue(new NotFoundError('Rider'));
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 404, 'NOT_FOUND');
  });

  it('VALIDATION_ERROR → 422 Unprocessable Entity', async () => {
    const handler = vi.fn().mockRejectedValue(new ValidationError('Invalid phone'));
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 422, 'VALIDATION_ERROR');
  });

  it('CONFLICT → 409', async () => {
    const handler = vi.fn().mockRejectedValue(new ConflictError('Duplicate entry'));
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 409, 'CONFLICT');
  });

  it('RATE_LIMITED → 429', async () => {
    const err = new ApiError('Slow down', ERROR_CODES.RATE_LIMITED, 429);
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 429, 'RATE_LIMITED');
  });

  it('GONE → 410', async () => {
    const err = new ApiError('Deprecated', ERROR_CODES.GONE, 410);
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 410, 'GONE');
  });

  it('unknown ApiError code → 400 Bad Request', async () => {
    const err = new ApiError('Service unavailable', ERROR_CODES.SERVICE_UNAVAILABLE, 503);
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 400, 'BAD_REQUEST');
  });

  it('SERVER_ERROR code (e.g. ServerError) falls through to badRequest (400)', async () => {
    // ServerError has code SERVER_ERROR which is NOT explicitly handled.
    // The ApiError if-chain hits the default → errors.badRequest() → 400.
    const err = new ApiError('DB crash', ERROR_CODES.SERVER_ERROR, 500);
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 400, 'BAD_REQUEST');
  });
});

// ---------------------------------------------------------------------------
// Domain-specific error names
// ---------------------------------------------------------------------------

describe('withApiHandler — domain-specific errors', () => {
  beforeEach(() => vi.clearAllMocks());

  function namedError(name: string, message: string, code?: string) {
    const err = new Error(message);
    err.name = name;
    (err as any).code = code;
    return err;
  }

  describe('RentalBookError', () => {
    it('with code NOT_FOUND → 404', async () => {
      const err = namedError('RentalBookError', 'Vehicle not available', 'NOT_FOUND');
      const handler = vi.fn().mockRejectedValue(err);
      const wrapped = withApiHandler(handler);
      await expectErrorResponse(wrapped, 404, 'NOT_FOUND');
    });

    it('with code CONFLICT → 409', async () => {
      const err = namedError('RentalBookError', 'Already booked', 'CONFLICT');
      const handler = vi.fn().mockRejectedValue(err);
      const wrapped = withApiHandler(handler);
      await expectErrorResponse(wrapped, 409, 'CONFLICT');
    });

    it('with unknown code → 400', async () => {
      const err = namedError('RentalBookError', 'Some rental error', 'INTERNAL');
      const handler = vi.fn().mockRejectedValue(err);
      const wrapped = withApiHandler(handler);
      await expectErrorResponse(wrapped, 400, 'BAD_REQUEST');
    });

    it('with no code → 400', async () => {
      const err = namedError('RentalBookError', 'Generic rental error');
      const handler = vi.fn().mockRejectedValue(err);
      const wrapped = withApiHandler(handler);
      await expectErrorResponse(wrapped, 400, 'BAD_REQUEST');
    });
  });

  it('KycStateError → 409 Conflict', async () => {
    const err = namedError('KycStateError', 'KYC already submitted');
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 409, 'CONFLICT');
  });

  it('GuarantorStateError → 409 Conflict', async () => {
    const err = namedError('GuarantorStateError', 'Guarantor already verified');
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 409, 'CONFLICT');
  });

  it('DepositStateMachineError → 409 Conflict', async () => {
    const err = namedError('DepositStateMachineError', 'Invalid deposit state transition');
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 409, 'CONFLICT');
  });

  it('RentalStateError → 409 Conflict', async () => {
    const err = namedError('RentalStateError', 'Invalid rental state transition');
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 409, 'CONFLICT');
  });
});

// ---------------------------------------------------------------------------
// Message-based fallback
// ---------------------------------------------------------------------------

describe('withApiHandler — message-based fallback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('error message containing "not found" → 404', async () => {
    const err = new Error('Rider not found in database');
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 404, 'NOT_FOUND');
  });

  it('error message containing "Not found" → 404 (case-sensitive match)', async () => {
    const err = new Error('Not found: vehicle 123');
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 404, 'NOT_FOUND');
  });

  it('error message without "not found" → 500', async () => {
    const err = new Error('Database connection timeout');
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 500, 'SERVER_ERROR');
  });
});

// ---------------------------------------------------------------------------
// Unknown errors → 500 internal
// ---------------------------------------------------------------------------

describe('withApiHandler — unknown errors', () => {
  beforeEach(() => vi.clearAllMocks());

  it('generic Error → 500 Internal Server Error', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Something went wrong'));
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 500, 'SERVER_ERROR');
  });

  it('string thrown → 500 with string as message', async () => {
    const handler = vi.fn().mockRejectedValue('just a string error');
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 500, 'SERVER_ERROR');
  });

  it('object thrown with message → 500', async () => {
    const handler = vi.fn().mockRejectedValue({ message: 'object error' });
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 500, 'SERVER_ERROR');
  });

  it('object thrown without message → 500 with default message', async () => {
    const handler = vi.fn().mockRejectedValue({ custom: 'error' });
    const wrapped = withApiHandler(handler);
    await expectErrorResponse(wrapped, 500, 'SERVER_ERROR');
  });

  it('includes error message in 500 response', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('Critical failure'));
    const wrapped = withApiHandler(handler);
    const res = await wrapped(mockRequest());
    expect(res.body.error.message).toContain('Critical failure');
  });
});

// ---------------------------------------------------------------------------
// Middleware integration
// ---------------------------------------------------------------------------

describe('withApiHandler — middleware integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('wraps a middleware-style handler chain correctly', async () => {
    const innerHandler = vi
      .fn()
      .mockResolvedValue({
        status: 200,
        body: { success: true, data: 'ok' },
        headers: new Headers(),
      });

    const middleware = (req: any) => {
      if (!req.headers.get('authorization')) {
        throw new AuthError('No token');
      }
      return innerHandler(req);
    };

    const wrapped = withApiHandler(middleware);

    const req = mockRequest();
    req.headers.set('authorization', 'Bearer valid-token');
    const result = await wrapped(req);

    expect(result.status).toBe(200);
    expect(innerHandler).toHaveBeenCalledTimes(1);
  });

  it('catches auth errors from middleware', async () => {
    const middleware = vi.fn().mockRejectedValue(new AuthError('Invalid token'));
    const wrapped = withApiHandler(middleware);
    const req = mockRequest();

    const result = await wrapped(req);
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe('UNAUTHORIZED');
  });

  it('catches validation errors from middleware', async () => {
    const middleware = vi.fn().mockRejectedValue(new ValidationError('Missing field'));
    const wrapped = withApiHandler(middleware);

    const result = await wrapped(mockRequest());
    // errors.validation() returns 422, not 400
    expect(result.status).toBe(422);
    expect(result.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('catches not-found errors from middleware', async () => {
    const middleware = vi.fn().mockRejectedValue(new NotFoundError('Rider'));
    const wrapped = withApiHandler(middleware);

    const result = await wrapped(mockRequest());
    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe('NOT_FOUND');
  });

  it('allows the success path through auth middleware + handler', async () => {
    const handler = vi
      .fn()
      .mockResolvedValue({
        status: 200,
        body: { success: true, data: 'dashboard' },
        headers: new Headers(),
      });

    const wrapped = withApiHandler(handler);
    const req = mockRequest('/api/rider/dashboard');

    const result = await wrapped(req);
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, data: 'dashboard' });
  });
});
