/**
 * Shared RBAC (Role-Based Access Control) utilities.
 * Re-exports from src/lib/rbac.
 */

export {
  getPermissionsForRole,
  hasPermission,
  requirePermission,
  type AdminRole,
  type Permission,
} from '@/lib/rbac';
