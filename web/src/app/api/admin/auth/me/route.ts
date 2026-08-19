import { NextRequest } from 'next/server';
import { success, errors, error } from '@/lib/api-response';
import { getAdminSession } from '@/lib/get-session';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';
import { logger } from '@/lib/logger';

export async function GET(_request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return errors.unauthorized('Not authenticated');
  }

  // P1-15: getAdminSession already guarantees role === 'admin', and admin
  // tokens are issued with adminId === riderDbId, so the riderDbId fallback
  // was dead — keep only the canonical admin id and fail loudly otherwise.
  if (!session.adminId) {
    return errors.unauthorized('Not authenticated');
  }
  const adminId = session.adminId;

  let admin;
  try {
    admin = await adminUseCases.getMe(adminId);
  } catch (err: unknown) {
    // P0-8: a DB outage must not masquerade as a 403 "account validation"
    // failure — surface 503 so operators can tell auth failures apart from
    // infrastructure problems (getMe no longer swallows DB errors).
    logger.error('[GET /api/admin/auth/me] DB error', err);
    return error('Account service unavailable', 'SERVICE_UNAVAILABLE', 503);
  }

  if (!admin) {
    return errors.unauthorized('Account not found');
  }
  if (!admin.isActive) {
    return errors.forbidden('Account deactivated');
  }

  // P0-8/P2-9/P2-10: getMe's select already excludes the password hash,
  // but this route is the LAST line of defense — if a future getMe change
  // regresses and leaks the hash, strip it here so the client never sees it.
  // (Typed sweep 2026-08-16: `as { password?: string }` documents that
  // `password` is a forbidden field we actively remove, not one the typed
  // admin row carries.)
  const { password: _password, ...safeAdmin } = admin as { password?: string };
  void _password;
  return success(safeAdmin);
}
