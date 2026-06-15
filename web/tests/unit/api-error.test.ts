import {
  ERROR_CODES,
  ApiError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  ServerError,
  isApiError,
  getErrorCode,
} from '../../src/lib/api-error';

describe('api-error', () => {
  describe('ERROR_CODES', () => {
    it('has all required error codes', () => {
      expect(ERROR_CODES.UNAUTHORIZED).toBe('UNAUTHORIZED');
      expect(ERROR_CODES.FORBIDDEN).toBe('FORBIDDEN');
      expect(ERROR_CODES.NOT_FOUND).toBe('NOT_FOUND');
      expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ERROR_CODES.SERVER_ERROR).toBe('SERVER_ERROR');
      expect(ERROR_CODES.BAD_REQUEST).toBe('BAD_REQUEST');
      expect(ERROR_CODES.CONFLICT).toBe('CONFLICT');
      expect(ERROR_CODES.RATE_LIMITED).toBe('RATE_LIMITED');
      expect(ERROR_CODES.SERVICE_UNAVAILABLE).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('ApiError', () => {
    it('creates error with code and status', () => {
      const error = new ApiError('Test error', ERROR_CODES.BAD_REQUEST, 400);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(ERROR_CODES.BAD_REQUEST);
      expect(error.status).toBe(400);
      expect(error.name).toBe('ApiError');
    });

    it('defaults to 500 status', () => {
      const error = new ApiError('Test error', ERROR_CODES.SERVER_ERROR);
      expect(error.status).toBe(500);
    });

    it('has stack trace', () => {
      const error = new ApiError('Test error', ERROR_CODES.BAD_REQUEST);
      expect(error.stack).toBeDefined();
    });
  });

  describe('AuthError', () => {
    it('creates 401 error with UNAUTHORIZED code', () => {
      const error = new AuthError();
      expect(error.message).toBe('Authentication required');
      expect(error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(error.status).toBe(401);
    });

    it('accepts custom message', () => {
      const error = new AuthError('Please log in');
      expect(error.message).toBe('Please log in');
    });
  });

  describe('ForbiddenError', () => {
    it('creates 403 error with FORBIDDEN code', () => {
      const error = new ForbiddenError();
      expect(error.message).toBe('Access denied');
      expect(error.code).toBe(ERROR_CODES.FORBIDDEN);
      expect(error.status).toBe(403);
    });

    it('accepts custom message', () => {
      const error = new ForbiddenError('Admin only');
      expect(error.message).toBe('Admin only');
    });
  });

  describe('NotFoundError', () => {
    it('creates 404 error with NOT_FOUND code', () => {
      const error = new NotFoundError();
      expect(error.message).toBe('Resource not found');
      expect(error.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(error.status).toBe(404);
    });

    it('includes resource name in message', () => {
      const error = new NotFoundError('Rider');
      expect(error.message).toBe('Rider not found');
    });
  });

  describe('ValidationError', () => {
    it('creates 400 error with VALIDATION_ERROR code', () => {
      const error = new ValidationError();
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.status).toBe(400);
    });

    it('accepts custom message', () => {
      const error = new ValidationError('Phone number invalid');
      expect(error.message).toBe('Phone number invalid');
    });
  });

  describe('ConflictError', () => {
    it('creates 409 error with CONFLICT code', () => {
      const error = new ConflictError();
      expect(error.message).toBe('Resource already exists');
      expect(error.code).toBe(ERROR_CODES.CONFLICT);
      expect(error.status).toBe(409);
    });

    it('accepts custom message', () => {
      const error = new ConflictError('Duplicate phone number');
      expect(error.message).toBe('Duplicate phone number');
    });
  });

  describe('ServerError', () => {
    it('creates 500 error with SERVER_ERROR code', () => {
      const error = new ServerError();
      expect(error.message).toBe('Internal server error');
      expect(error.code).toBe(ERROR_CODES.SERVER_ERROR);
      expect(error.status).toBe(500);
    });

    it('accepts custom message', () => {
      const error = new ServerError('Database connection failed');
      expect(error.message).toBe('Database connection failed');
    });
  });

  describe('isApiError', () => {
    it('returns true for ApiError instances', () => {
      const error = new ApiError('test', ERROR_CODES.BAD_REQUEST);
      expect(isApiError(error)).toBe(true);
    });

    it('returns true for subclasses', () => {
      expect(isApiError(new AuthError())).toBe(true);
      expect(isApiError(new ForbiddenError())).toBe(true);
      expect(isApiError(new NotFoundError())).toBe(true);
      expect(isApiError(new ValidationError())).toBe(true);
      expect(isApiError(new ConflictError())).toBe(true);
      expect(isApiError(new ServerError())).toBe(true);
    });

    it('returns false for regular Error', () => {
      const error = new Error('test');
      expect(isApiError(error)).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isApiError(null)).toBe(false);
      expect(isApiError(undefined)).toBe(false);
    });

    it('returns false for string', () => {
      expect(isApiError('error')).toBe(false);
    });
  });

  describe('getErrorCode', () => {
    it('extracts code from ApiError', () => {
      const error = new ApiError('test', ERROR_CODES.BAD_REQUEST);
      expect(getErrorCode(error)).toBe(ERROR_CODES.BAD_REQUEST);
    });

    it('extracts code from AuthError', () => {
      const error = new AuthError();
      expect(getErrorCode(error)).toBe(ERROR_CODES.UNAUTHORIZED);
    });

    it('returns SERVER_ERROR for non-ApiError', () => {
      const error = new Error('test');
      expect(getErrorCode(error)).toBe(ERROR_CODES.SERVER_ERROR);
    });

    it('returns SERVER_ERROR for null', () => {
      expect(getErrorCode(null)).toBe(ERROR_CODES.SERVER_ERROR);
    });
  });
});
