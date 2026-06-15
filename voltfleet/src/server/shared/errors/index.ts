/**
 * Shared error types and error handling utilities.
 * Re-exports from src/lib/api-error.
 */

export {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalError,
  errorResponse,
} from '@/lib/api-error';
