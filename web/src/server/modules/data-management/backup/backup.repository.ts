/**
 * Backup repository stub.
 */

import { db } from '@/lib/db';

export const backupRepository = {
  async getBackupJob(id: string) {
    return (db as any).backupJob?.findUnique({ where: { id } }) ?? null;
  },

  async createRestoreJob(data: any) {
    return (db as any).restoreJob?.create({ data }) ?? { id: 'restore-1', ...data };
  },

  async updateRestoreJob(id: string, data: any) {
    return (db as any).restoreJob?.update({ where: { id }, data }) ?? { id, ...data };
  },
};
