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
  constructor(message: string = 'Invalid input') {
    super(message, ERROR_CODES.VALIDATION_ERROR, 400);
    this.name = 'ValidationError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string = 'Resource already exists') {
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
