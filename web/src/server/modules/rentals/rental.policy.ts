/**
 * Rentals module - Policy.
 *
 * Authorization rules for rental operations.
 */
import { AdminRole } from '../admin/admin.types';
export const rentalPolicy = {
  canSelectPlan(riderDbId: string, sessionRiderId: string): boolean {
    return sessionRiderId === riderDbId;
  },

  canStartPickup(adminRole: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN, AdminRole.HUB_MANAGER, AdminRole.FLEET_MANAGER].includes(adminRole);
  },

  canApproveReturn(adminRole: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN, AdminRole.HUB_MANAGER].includes(adminRole);
  },

  canViewRental(actorRole: string, targetRiderId: string, sessionRiderId?: string): boolean {
    if (actorRole === 'admin') return true;
    return sessionRiderId === targetRiderId;
  },
};
