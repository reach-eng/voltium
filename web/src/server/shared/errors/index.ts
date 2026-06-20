/**
 * Shared — Errors
 *
 * Re-exports error utilities from the canonical source.
 * All modules should import from here instead of @/lib/api-error directly.
 */

export { ApiError } from '@/lib/api-error';
export type { ApiResponse } from '@/lib/api-response';
export { errors } from '@/lib/api-response';
