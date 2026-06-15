/**
 * Shared — RBAC
 *
 * Re-exports role-based access control utilities.
 */

export {
  hasPermission,
  getPermissionsForRole,
  PERMISSIONS,
  PERMISSION_DESCRIPTORS,
  ADMIN_ROLES,
} from '@/lib/auth';
export type { Permission, AdminRole } from '@/lib/auth';
