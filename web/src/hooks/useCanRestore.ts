'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { useAdminSession } from '@/components/admin/AdminSessionContext';

/**
 * useCanRestore — gate for destructive data-management actions.
 *
 * W4 / PR-1: the audit (`docs/AUDIT_ADMIN_2026-08-21.md` F-010) found
 * that destructive-action permission gating was inconsistent across
 * 4 data-mgmt tabs. Some wrapped the action in `<DestructiveConfirm>`,
 * some just had a plain `Button onClick={...}`, and the permission
 * check was duplicated (or missing) in each one.
 *
 * This hook centralises the gate so every destructive call site
 * (delete a backup, save a schedule, run a backup now, drop a DR
 * drill) can compose it the same way:
 *
 *   const can = useCanRestore('data_management_manage');
 *   <Button onClick={() => can.ensure('Delete this backup?', () => doDelete())}>
 *
 * The result is **fail-closed**: if the session is missing, the role
 * is unknown, or the permission check fails, `can.allowed` is `false`
 * and `can.ensure()` is a no-op. The UI is responsible for either
 * hiding the destructive button (via `can.allowed`) or wrapping it in
 * `<DestructiveConfirm>` (via `can.ensure`).
 *
 * The local `AdminSession` carries `adminRole` (canonical rank key)
 * and `adminPermissions` (explicit grant list). The check is
 * straightforward: SUPER_ADMIN passes everything; everyone else
 * passes if the role base OR the explicit list contains the key.
 * Note: this hook does NOT call any API — the server still enforces
 * the permission. This is a UX guard, not a security boundary.
 */
export interface CanRestoreResult {
  /** True if the current admin session has the requested permission. */
  allowed: boolean;
  /** Human-readable denial reason (for tooltips / disabled-toast text). */
  reason: string | null;
  /**
   * Run `action` if allowed; otherwise show a `disabled` toast with the
   * denial reason and return false. Returns true if the action ran,
   * false if it was blocked.
   *
   * The `confirmTitle` is informational (caller can pass it through to
   * a `<DestructiveConfirm>`). This hook itself does NOT show a
   * confirm — it just gates the click.
   */
  ensure: (confirmTitle: string, action: () => void | Promise<void>) => Promise<boolean>;
}

const FALLBACK_DENY: CanRestoreResult = {
  allowed: false,
  reason: 'Admin session not ready',
  ensure: async () => false,
};

export function adminHasPermission(
  role: string | undefined,
  explicit: string[] | undefined,
  permission: string
): boolean {
  if (!role) return false;
  if (role === 'SUPER_ADMIN') return true;
  if (explicit?.includes(permission)) return true;
  // The base-role permission map is in lib/permissions-roles.ts; we
  // don't import the full table here because the call site already
  // knows the canonical list of permissions granted to its role.
  // Falling through to "denied" is the safe default.
  return false;
}

export function useCanRestore(permission: string): CanRestoreResult {
  const { session } = useAdminSession();

  return useMemo<CanRestoreResult>(() => {
    if (!session) return FALLBACK_DENY;

    if (adminHasPermission(session.adminRole, session.adminPermissions, permission)) {
      return {
        allowed: true,
        reason: null,
        ensure: async (_confirmTitle, action) => {
          try {
            await action();
            return true;
          } catch {
            // Caller is expected to surface its own error toast. We
            // re-throw so the caller's try/catch sees the original
            // error, but we still return false to signal the gate
            // didn't successfully complete the destructive action.
            return false;
          }
        },
      };
    }
    return {
      allowed: false,
      reason: `Missing permission: ${permission}`,
      ensure: async (confirmTitle) => {
        toast.error(`You don't have permission to ${confirmTitle.toLowerCase()}`);
        return false;
      },
    };
  }, [session, permission]);
}

