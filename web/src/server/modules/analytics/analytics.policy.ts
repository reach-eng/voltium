/**
 * Analytics module — Policy
 *
 * Authorization rules for analytics access.
 */

import { AdminRole } from '../admin/admin.types';

export const analyticsPolicy = {
  canViewDashboard(adminRole: string): { allowed: boolean; reason?: string } {
    const allowedRoles: string[] = [
      AdminRole.SUPER_ADMIN,
      AdminRole.OPERATIONS_ADMIN,
      AdminRole.HUB_MANAGER,
      AdminRole.FLEET_MANAGER,
    ];
    if (allowedRoles.includes(adminRole)) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Insufficient permissions to view analytics' };
  },
};
