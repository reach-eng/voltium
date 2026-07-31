/**
 * Backup service stub.
 */

export const backupService = {
  async createBackup(type: string = 'MANUAL', notes?: string) {
    return { id: 'backup-1', type, notes, status: 'SUCCESS' };
  },

  async verifyBackup(id: string) {
    return { id, verified: true };
  },

  async deleteBackup(id: string) {
    return { id, deleted: true };
  },
};
