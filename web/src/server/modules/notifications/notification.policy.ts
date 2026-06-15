/**
 * Notifications module - Policy.
 *
 * Authorization rules for notification operations.
 */
import { AdminRole } from '../admin/admin.types';
export const notificationPolicy = {
  canViewNotifications(riderDbId: string, sessionRiderId: string): boolean {
    return sessionRiderId === riderDbId;
  },

  canSendNotifications(adminRole: string): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN].includes(adminRole);
  },

  canBroadcast(adminRole: string): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN].includes(adminRole);
  },
};
