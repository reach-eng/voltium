/**
 * Role-Based Access Control (RBAC) — public API.
 *
 * ━ Ticket #15 consolidation ━
 * This file is now a thin re-export layer over the split modules:
 *   - `permissions-descriptors.ts` — canonical list of permission keys
 *     (with labels and categories). Add new permissions here.
 *   - `permissions-roles.ts` — which roles have each permission. The
 *     policy matrix. Add role assignments here.
 *   - `permissions.ts` (this file) — the public surface (PERMISSIONS
 *     map, Permission type, hasPermission, getPermissionsForRole,
 *     parsePermissions, serializePermissions).
 *
 * Browser-safe: no DB/prisma imports.
 *
 * Backward compat: existing imports from `@/lib/permissions` keep
 * working unchanged. SUPER_ADMIN implicitly has all permissions.
 */

import {
  ADMIN_ROLES,
  PERMISSION_DESCRIPTORS,
  PERMISSION_KEYS,
  type AdminRole,
  type PermissionDescriptor,
} from './permissions-descriptors';

export {
  ADMIN_ROLES,
  PERMISSION_DESCRIPTORS,
  PERMISSION_KEYS,
  type AdminRole,
  type PermissionDescriptor,
} from './permissions-descriptors';

import type { SessionPayload } from './session-payload';

export type { SessionPayload } from './session-payload';

import { ROLE_PERMISSIONS } from './permissions-roles';

/**
 * Backward-compat map: same shape as the old `PERMISSIONS_MAP`.
 * Derived from ROLE_PERMISSIONS — single source of truth is the
 * `permissions-roles.ts` policy file.
 */
const PERMISSIONS_MAP: Readonly<Record<string, readonly AdminRole[]>> = ROLE_PERMISSIONS;

export const PERMISSIONS = Object.freeze(PERMISSIONS_MAP) as Readonly<
  Record<string, readonly AdminRole[]>
>;

export type Permission = keyof typeof ROLE_PERMISSIONS;

/**
 * Check if a role or session has a specific permission.
 *
 * Accepts either:
 * - A string role name (e.g. 'SUPER_ADMIN', 'SUPPORT_AGENT')
 * - A SessionPayload object (reads adminRole/role and adminPermissions)
 *
 * When a SessionPayload is provided, the effective role is resolved as:
 *   adminRole (if admin) > role (user type) > ''
 * If the session has explicit permissions (adminPermissions), those take
 * precedence over the role-based PERMISSIONS lookup.
 */
export function hasPermission(
  roleOrSession: string | SessionPayload,
  permission: Permission
): boolean {
  if (typeof roleOrSession === 'object' && roleOrSession !== null) {
    const session = roleOrSession;
    const effectiveRole = session.adminRole || session.role || '';

    if (effectiveRole === 'SUPER_ADMIN') return true;

    // Explicit permissions from the session take precedence over role-based lookup
    const perms = session.adminPermissions || (session as any).permissions;
    if (perms && Array.isArray(perms) && perms.length > 0) {
      return perms.includes(permission);
    }

    // Fall back to role-based lookup
    return hasPermission(effectiveRole, permission);
  }

  const role = roleOrSession;
  if (role === 'SUPER_ADMIN') return permission in PERMISSIONS;

  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) return false;
  return (allowedRoles as readonly string[]).includes(role);
}

export function getPermissionsForRole(role: string): Permission[] {
  const adminRole = role as AdminRole;
  if (adminRole === 'SUPER_ADMIN') {
    return Object.keys(PERMISSIONS) as Permission[];
  }
  return (Object.keys(PERMISSIONS) as Permission[]).filter((perm) =>
    (PERMISSIONS[perm] as readonly string[]).includes(adminRole)
  );
}
