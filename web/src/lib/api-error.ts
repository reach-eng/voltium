export const ERROR_CODES = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  GONE: 'GONE',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const isErrorCode = (val: string): val is ErrorCode => {
  return Object.values(ERROR_CODES).includes(val as ErrorCode);
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly status: number = 500
  ) {
    super(message);
    this.name = 'ApiError';
    Error.captureStackTrace(this, ApiError);
  }
}

export class AuthError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, ERROR_CODES.UNAUTHORIZED, 401);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends ApiError {
  constructor(message: string = 'Access denied') {
    super(message, ERROR_CODES.FORBIDDEN, 403);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, ERROR_CODES.NOT_FOUND, 404);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string = 'Invalid input', public readonly details?: unknown, status: number = 400) {
    super(message, ERROR_CODES.VALIDATION_ERROR, status);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string = 'Resource already exists', public readonly details?: unknown) {
    super(message, ERROR_CODES.CONFLICT, 409);
    this.name = 'ConflictError';
  }
}

export class ServerError extends ApiError {
  constructor(message: string = 'Internal server error') {
    super(message, ERROR_CODES.SERVER_ERROR, 500);
    this.name = 'ServerError';
  }
}

export const isApiError = (error: unknown): error is ApiError => {
  return error instanceof ApiError;
};

export const getErrorCode = (error: unknown): ErrorCode => {
  if (isApiError(error)) {
    return error.code;
  }
  return ERROR_CODES.SERVER_ERROR;
};

export class BadRequestError extends ApiError {
  constructor(message: string = 'Bad request', public readonly details?: unknown) {
    super(message, ERROR_CODES.BAD_REQUEST, 400);
    this.name = 'BadRequestError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Too many requests', public readonly details?: unknown) {
    super(message, ERROR_CODES.RATE_LIMITED, 429);
    this.name = 'RateLimitError';
  }
}

export class GoneError extends ApiError {
  constructor(message: string = 'Resource gone', public readonly details?: unknown) {
    super(message, ERROR_CODES.GONE, 410);
    this.name = 'GoneError';
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message: string = 'Service unavailable', public readonly details?: unknown) {
    super(message, ERROR_CODES.SERVICE_UNAVAILABLE, 503);
    this.name = 'ServiceUnavailableError';
  }
}

export interface NormalizedErrorPayload {
  code: ErrorCode;
  message: string;
  status: number;
  details?: unknown;
}

export function normalizeError(err: unknown): NormalizedErrorPayload {
  if (isApiError(err)) {
    return {
      code: err.code,
      message: err.message,
      status: err.status,
      details: (err as any).details,
    };
  }
  if (err && typeof err === 'object' && (err as any).name === 'ZodError') {
    return {
      code: ERROR_CODES.VALIDATION_ERROR,
      message: (err as any).message || 'Validation failed',
      status: 422,
      details: (err as any).issues,
    };
  }
  return {
    code: ERROR_CODES.SERVER_ERROR,
    message: err instanceof Error ? err.message : typeof err === 'string' ? err : 'Unknown error',
    status: 500,
  };
}
