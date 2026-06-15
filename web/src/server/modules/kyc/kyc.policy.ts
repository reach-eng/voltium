/**
 * KYC module - Policy.
 *
 * Authorization rules for KYC operations.
 */
import { AdminRole } from '../admin/admin.types';
export const kycPolicy = {
  canSubmitKyc(riderDbId: string, sessionRiderId: string): boolean {
    return sessionRiderId === riderDbId;
  },

  canReviewKyc(adminRole: string): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN, AdminRole.TEAM_LEADER].includes(adminRole);
  },

  canViewKyc(actorRole: string, targetRiderId: string, sessionRiderId?: string): boolean {
    if (actorRole === 'admin') return true;
    return sessionRiderId === targetRiderId;
  },
};
