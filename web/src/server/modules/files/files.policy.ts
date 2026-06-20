export const filePolicy = {
  canRiderAccess(riderDbId: string, fileOwnerId: string): boolean {
    return riderDbId === fileOwnerId;
  },

  canUpload(actorRole: string, actorRiderId: string | null, targetRiderId: string): boolean {
    if (actorRole === 'admin') return true;
    return actorRiderId === targetRiderId;
  },

  canViewFile(actor: { role: string; permissions?: string[]; riderDbId?: string }, fileRecord: { ownerId: string; purpose: string; visibility: string }): boolean {
    if (actor.role === 'rider') {
      return actor.riderDbId === fileRecord.ownerId;
    }

    if (actor.role === 'admin') {
      const permissionMap: Record<string, string> = {
        kyc_document: 'files_view_kyc',
        profile_photo: 'files_view_kyc',
        vehicle_photo: 'files_view_kyc',
        payment_proof: 'files_view_payment_proof',
        support_attachment: 'files_view_support_attachment',
      };
      const required = permissionMap[fileRecord.purpose];
      if (!required) return true;
      return actor.permissions?.includes(required) ?? false;
    }

    return false;
  },
};
