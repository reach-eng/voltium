/**
 * RBAC route helpers.
 *
 * ━ Ticket #15 consolidation ━
 * `lib/rbac.ts` is now a thin layer over `lib/auth.ts` + `lib/permissions.ts`.
 * Most helpers are re-exports; only `parsePaginationParams` is local
 * because it's specific to the request-handling context.
 *
 * For new code, prefer importing from `@/lib/auth` and `@/lib/permissions`
 * directly. This file is kept for backward compat with the 30+ import
 * sites that already use it.
 */

import { getAdminSession } from '@/lib/get-session';
import { hasPermission, type Permission } from '@/lib/auth';
import { errors } from '@/lib/api-response';
import type { SessionPayload } from '@/lib/auth';
import { logPermissionDenied } from '@/lib/security-events';

export type { SessionPayload } from '@/lib/auth';
export { requireAdminSession } from '@/server/modules/admin/admin.policy';

export async function requireAdmin(): Promise<SessionPayload | null> {
  return await getAdminSession();
}

export async function requirePermission(permission: Permission): Promise<SessionPayload | null> {
  const session = await getAdminSession();
  if (!session) return null;
  // AUDIT FIX (N-5): pass the SESSION OBJECT, not the bare role string.
  // The string form ignored per-admin `adminPermissions`, so explicit
  // grants were silently dropped (and revocations bypassed) at every
  // route that used this helper.
  if (!hasPermission(session, permission)) {
    return null;
  }
  return session;
}

export function adminUnauthorized() {
  return errors.unauthorized('Admin authentication required');
}

export function adminForbidden(message?: string) {
  return errors.forbidden(message || 'Insufficient permissions for this action');
}

/**
 * Same as adminForbidden() but ALSO fires the security-events logger.
 *
 * Use this in route handlers where you have the session + permission
 * context — it ensures every permission-denied event lands in the
 * audit log (SOC2 requirement) without changing the API surface.
 *
 * The logger call is fire-and-forget (void) so the route's response
 * is not delayed by an audit-log write.
 *
 * @param context.session    - the session that was denied (or null for
 *                             anonymous — only used for actorId)
 * @param context.permission - the permission string the admin lacked
 * @param context.route      - the API route path (e.g. /api/admin/hubs)
 * @param context.ip         - request IP (from req.headers.get('x-forwarded-for'))
 * @param message            - optional error message
 */
export function adminForbiddenWithLog(
  context: {
    session: SessionPayload | null;
    permission: string;
    route: string;
    ip?: string;
  },
  message?: string
) {
  // Fire-and-forget logger call
  void logPermissionDenied({
    adminId: context.session?.adminId || 'anonymous',
    permission: context.permission,
    route: context.route,
    ip: context.ip,
  });
  return errors.forbidden(message || 'Insufficient permissions for this action');
}

/**
 * DEEP-AUDIT D-P1-1 (2026-08-08): removed. The implementation used
 * `parseInt()` (NaN-prone on `?page=abc` — Math.max(1, NaN) === NaN,
 * which then crashes Prisma's skip/take). Every paginated route now
 * uses `parsePositiveInt` from `@/lib/api-utils`, which clamps to a
 * safe finite integer ≥ 1. Import sites updated.
 */
// parsePaginationParams removed — see DEEP-AUDIT D-P1-1
