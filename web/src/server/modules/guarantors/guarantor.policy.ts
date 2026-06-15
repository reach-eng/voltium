/**
 * Guarantors module - Policy.
 *
 * Authorization rules for guarantor operations.
 */

export const guarantorPolicy = {
  canSubmitGuarantor(riderDbId: string, sessionRiderId: string): boolean {
    return sessionRiderId === riderDbId;
  },

  canViewGuarantor(actorRole: string, targetRiderId: string, sessionRiderId?: string): boolean {
    if (actorRole === 'admin') return true;
    return sessionRiderId === targetRiderId;
  },

  canReviewGuarantor(adminRole: string): boolean {
    return [AdminRole.SUPER_ADMIN, AdminRole.OPERATIONS_ADMIN, AdminRole.TEAM_LEADER].includes(adminRole);
  },

  canReplaceGuarantor(riderDbId: string, sessionRiderId: string): boolean {
    return sessionRiderId === riderDbId;
  },
};
