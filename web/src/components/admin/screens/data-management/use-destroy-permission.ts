'use client';

/**
 * Phase 7G PR-138 — destructive-action permission gate for data-management tabs.
 *
 * `RestoreTab` and `DisasterRecoveryTab` are safety-critical screens:
 * they expose buttons that can destroy or rewrite live data (start a
 * restore, toggle maintenance, trigger an emergency backup). The server
 * enforces the `data_management_restore` permission on every destructive
 * endpoint, but the UI used to render the buttons even for admins who
 * lack that permission. The user would discover the lack of permission
 * only when the POST returned 403.
 *
 * This module exposes a small `useCanRestore()` hook that returns
 * whether the current admin session can perform destructive actions.
 * The tabs use it to disable (Restore) or hide (DR) the destructive
 * controls. The hook centralises the permission lookup so a future
 * tab that ships in this directory can adopt the same gate with one
 * import.
 *
 * Browser-safe: no DB / prisma imports. Pure session + permissions.
 */

import { useAdminSession } from '../../AdminSessionContext';
import { hasPermission, type SessionPayload } from '@/lib/permissions';

/**
 * Shape of the session object that `useAdminSession()` returns. The
 * `SessionPayload` type from `lib/permissions.ts` is the canonical
 * permission-check input; the runtime session from the context is a
 * superset of those fields. The cast below is safe because
 * `hasPermission` only reads `adminRole`, `role`, and
 * `adminPermissions` (or `permissions`).
 */
type ContextSession = NonNullable<ReturnType<typeof useAdminSession>['session']>;

/**
 * Adapt the runtime context session into a `SessionPayload` that
 * `hasPermission` accepts. We use `adminRole` if present, else
 * `role` (the user type), so a SUPER_ADMIN that only has `role`
 * but no `adminRole` still resolves correctly.
 */
function toSessionPayload(session: ContextSession): SessionPayload {
  return {
    riderId: (session as any).riderId ?? '',
    riderDbId: (session as any).riderDbId ?? session.id,
    phone: (session as any).phone ?? '',
    role: session.role,
    adminRole: session.adminRole ?? session.role,
    adminId: session.adminId,
    adminPermissions: session.adminPermissions ?? session.permissions,
  };
}

/**
 * True iff the current admin can perform destructive actions in
 * data-management screens (restore, manual backup, maintenance-mode
 * toggle is gated separately on `settings_manage` and is intentionally
 * not covered here).
 *
 * Default to `false` while the session is still loading or when no
 * session is present. This is the safe default: the UI shows the
 * destructive controls in their disabled state, never the
 * click-through state.
 */
export function useCanRestore(): boolean {
  const { session, isLoading } = useAdminSession();
  if (isLoading) return false;
  if (!session) return false;
  return hasPermission(toSessionPayload(session), 'data_management_restore');
}
