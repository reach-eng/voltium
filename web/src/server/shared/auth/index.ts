/**
 * Shared — Auth
 *
 * Re-exports auth/session utilities from the canonical source.
 */

export {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  ADMIN_SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
} from '@/lib/auth';
export type { SessionPayload } from '@/lib/auth';
export { requireRiderSession } from '@/lib/rider-auth';
