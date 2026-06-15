/**
 * Shared — Errors
 *
 * Re-exports error utilities from the canonical source.
 * All modules should import from here instead of @/lib/api-error directly.
 */

export { errors } from '@/lib/api-error';
export type { ApiErrorResponse } from '@/lib/api-response';
