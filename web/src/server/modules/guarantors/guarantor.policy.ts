import { AdminRole } from '../admin/admin.types';

export const guarantorPolicy = {
  canSubmitGuarantor(riderDbId: string, sessionRiderId: string): boolean {
    return sessionRiderId === riderDbId;
  },

  canViewGuarantor(actorRole: string, targetRiderId: string, sessionRiderId?: string): boolean {
    if (actorRole === 'admin') return true;
    return sessionRiderId === targetRiderId;
  },

  canReviewGuarantor(adminRole: AdminRole): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN, AdminRole.KYC_REVIEWER].includes(
      adminRole
    );
  },

  canReplaceGuarantor(riderDbId: string, sessionRiderId: string): boolean {
    return sessionRiderId === riderDbId;
  },
};
