/**
 * Shared authentication utilities.
 * Re-exports from src/lib/auth.
 */

export {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  requireAuth,
  requireAdminAuth,
  getSessionFromRequest,
  type SessionPayload,
} from '@/lib/auth';
