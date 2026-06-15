/**
 * Deposits module - Policy.
 *
 * Authorization rules for deposit operations.
 */

import { AdminRole } from '../admin/admin.types';

export const depositPolicy = {
  canSubmitDeposit(riderDbId: string, sessionRiderId: string): boolean {
    return sessionRiderId === riderDbId;
  },

  canReviewDeposit(adminRole: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN].includes(adminRole);
  },

  canIssueRefund(adminRole: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN].includes(adminRole);
  },
};
