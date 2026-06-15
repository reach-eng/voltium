/**
 * Hubs module - Policy.
 *
 * Authorization rules for hub and team leader operations.
 */
import { AdminRole } from '../admin/admin.types';
export const hubPolicy = {
  canManageHubs(adminRole: string): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN].includes(adminRole);
  },

  canManageTeamLeaders(adminRole: string): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN].includes(adminRole);
  },

  canViewHubs(): boolean {
    return true; // Most roles can view hubs
  },
};
