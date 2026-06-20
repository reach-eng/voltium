import { NextResponse } from 'next/server';
import {
  ERROR_CODES,
  isApiError,
  getErrorCode,
  ApiError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  ServerError,
} from './api-error';
import type { ErrorCode } from './api-error';

export {
  ERROR_CODES,
  isApiError,
  getErrorCode,
  ApiError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  ServerError,
};
export type { ErrorCode };

// ── Standardized Response Types ─────────────────────────────────────────────

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiMeta {
  correlationId?: string;
  timestamp?: string;
}

export interface ApiPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponseSuccess<T = unknown> {
  success: true;
  data: T;
  message?: string;
  meta?: ApiMeta;
  pagination?: ApiPagination;
}

export interface ApiResponseError {
  success: false;
  error: ApiErrorDetail;
  meta?: ApiMeta;
}

export type ApiResponse<T = unknown> = ApiResponseSuccess<T> | ApiResponseError;

// ── Response Transformer ────────────────────────────────────────────────────

export function normalizeApiResponse<T = unknown>(response: unknown): ApiResponse<T> {
  if (!response || typeof response !== 'object') {
    return {
      success: false,
      error: {
        code: ERROR_CODES.SERVER_ERROR,
        message: 'Invalid response format',
      },
      meta: { timestamp: new Date().toISOString() },
    };
  }

  const body = response as Record<string, unknown>;

  if (body.success === true) {
    const success: ApiResponseSuccess<T> = {
      success: true,
      data: (body.data ?? null) as T,
      meta: { timestamp: new Date().toISOString() },
    };

    if (typeof body.message === 'string') success.message = body.message;
    if (body.pagination) success.pagination = body.pagination as ApiPagination;
    if (body.meta) success.meta = { ...success.meta, ...(body.meta as ApiMeta) };

    return success;
  }

  const errObj = body.error && typeof body.error === 'object' ? (body.error as Record<string, unknown>) : null;
  const errorDetail: ApiErrorDetail = {
    code: (errObj?.code as string) ?? (body.code as string) ?? ERROR_CODES.SERVER_ERROR,
    message: (errObj?.message as string) ?? (body.error as string) ?? (body.message as string) ?? 'Unknown error',
  };

  if (errObj && errObj.details !== undefined) {
    errorDetail.details = errObj.details;
  } else if (body.details !== undefined) {
    errorDetail.details = body.details;
  }

  const error: ApiResponseError = {
    success: false,
    error: errorDetail,
    meta: { timestamp: new Date().toISOString() },
  };

  if (body.meta) error.meta = { ...error.meta, ...(body.meta as ApiMeta) };

  return error;
}

// ── Internal Helpers ────────────────────────────────────────────────────────

interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
}

function buildMeta(options?: { correlationId?: string }): ApiMeta {
  const meta: ApiMeta = { timestamp: new Date().toISOString() };
  if (options?.correlationId) meta.correlationId = options.correlationId;
  return meta;
}

function addRateLimitHeaders(response: NextResponse, rateLimit: RateLimitInfo): void {
  response.headers.set('X-RateLimit-Limit', String(rateLimit.limit));
  response.headers.set('X-RateLimit-Remaining', String(rateLimit.remaining));
  response.headers.set('X-RateLimit-Reset', String(Math.floor(rateLimit.resetAt / 1000)));
}

function addCorrelationIdHeader(response: NextResponse, correlationId: string): void {
  response.headers.set('X-Correlation-ID', correlationId);
}

// ── Response Builders ───────────────────────────────────────────────────────

export function success<T = unknown>(
  data: T,
  message?: string,
  status: number = 200,
  pagination?: ApiPagination,
  options?: { correlationId?: string; rateLimit?: RateLimitInfo }
): NextResponse<ApiResponseSuccess<T>> {
  const body: ApiResponseSuccess<T> = {
    success: true,
    data,
    meta: buildMeta(options),
  };

  if (message !== undefined) body.message = message;
  if (pagination !== undefined) body.pagination = pagination;

  const response = NextResponse.json(body, { status });

  if (options?.correlationId) {
    addCorrelationIdHeader(response, options.correlationId);
  }
  if (options?.rateLimit) {
    addRateLimitHeaders(response, options.rateLimit);
  }

  return response;
}

export function error(
  message: string,
  code: ErrorCode = ERROR_CODES.SERVER_ERROR,
  status: number = 500,
  options?: { correlationId?: string; rateLimit?: RateLimitInfo; details?: unknown }
): NextResponse<ApiResponseError> {
  const body: ApiResponseError = {
    success: false,
    error: {
      code,
      message,
      details: options?.details,
    },
    meta: buildMeta(options),
  };

  const response = NextResponse.json(body, { status });

  if (options?.correlationId) {
    addCorrelationIdHeader(response, options.correlationId);
  }
  if (options?.rateLimit) {
    addRateLimitHeaders(response, options.rateLimit);
  }

  return response;
}

export const errors = {
  badRequest: (
    message = 'Bad Request',
    options?: { correlationId?: string; rateLimit?: RateLimitInfo; details?: unknown }
  ) => error(message, ERROR_CODES.BAD_REQUEST, 400, options),

  unauthorized: (
    message = 'Unauthorized',
    options?: { correlationId?: string; rateLimit?: RateLimitInfo; details?: unknown }
  ) => error(message, ERROR_CODES.UNAUTHORIZED, 401, options),

  forbidden: (
    message = 'Forbidden',
    options?: { correlationId?: string; rateLimit?: RateLimitInfo; details?: unknown }
  ) => error(message, ERROR_CODES.FORBIDDEN, 403, options),

  notFound: (
    message = 'Not Found',
    options?: { correlationId?: string; rateLimit?: RateLimitInfo; details?: unknown }
  ) => error(message, ERROR_CODES.NOT_FOUND, 404, options),

  conflict: (
    message = 'Conflict',
    options?: { correlationId?: string; rateLimit?: RateLimitInfo; details?: unknown }
  ) => error(message, ERROR_CODES.CONFLICT, 409, options),

  validation: (
    message = 'Validation Error',
    options?: { correlationId?: string; rateLimit?: RateLimitInfo; details?: unknown }
  ) => error(message, ERROR_CODES.VALIDATION_ERROR, 422, options),

  tooManyRequests: (
    message = 'Too Many Requests',
    options?: { correlationId?: string; rateLimit?: RateLimitInfo; details?: unknown }
  ) => error(message, ERROR_CODES.RATE_LIMITED, 429, options),

  gone: (
    message = 'Gone',
    options?: { correlationId?: string; rateLimit?: RateLimitInfo; details?: unknown }
  ) => error(message, ERROR_CODES.GONE, 410, options),

  internal: (
    message = 'Internal Server Error',
    options?: { correlationId?: string; rateLimit?: RateLimitInfo; details?: unknown }
  ) => error(message, ERROR_CODES.SERVER_ERROR, 500, options),
};
