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

export type { SessionPayload } from '@/lib/auth';

export async function requireAdmin(): Promise<SessionPayload | null> {
  return await getAdminSession();
}

export async function requirePermission(permission: Permission): Promise<SessionPayload | null> {
  const session = await getAdminSession();
  if (!session) return null;
  if (!hasPermission(session.adminRole || '', permission)) {
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
 * Parse `?page=N&limit=M` from a URL. Clamped to [1, 100] for limit.
 * Lives here (not in `permissions.ts`) because it's an HTTP helper,
 * not an RBAC concern.
 */
export function parsePaginationParams(url: URL): { page: number; limit: number } {
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const limitRaw = parseInt(url.searchParams.get('limit') || '20');
  const limit = Math.min(Math.max(1, limitRaw), 100);
  return { page, limit };
}
