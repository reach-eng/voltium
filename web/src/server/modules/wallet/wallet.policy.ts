/**
 * Wallet module - Policy.
 *
 * Authorization rules for wallet operations.
 */
import { AdminRole } from '../admin/admin.types';
export const walletPolicy = {
  canViewWallet(riderDbId: string, sessionRiderId: string): boolean {
    return sessionRiderId === riderDbId;
  },

  canApproveTopup(adminRole: string): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN].includes(adminRole);
  },

  canIssueRefund(adminRole: string): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN].includes(adminRole);
  },
};
