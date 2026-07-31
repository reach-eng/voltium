import { restoreService } from './restore.service';
import { backupPolicy } from '../backup/backup.policy';
import { backupRepository } from '../backup/backup.repository';
import type { AdminRole } from '../../admin/admin.types';
import { AuthError } from "@/lib/api-error";

export const restoreUseCases = {
  async validateRestore(backupId: string, adminId: string, adminRole: AdminRole) {
    if (!backupPolicy.canRestoreBackup(adminRole)) {
      throw new AuthError('Unauthorized');
    }
    return restoreService.validate(backupId, adminId);
  },

  async startRestore(backupId: string, adminId: string, adminRole: AdminRole) {
    if (!backupPolicy.canRestoreBackup(adminRole)) {
      throw new AuthError('Unauthorized');
    }
    return restoreService.startRestore(backupId, adminId);
  },

  async getRestoreHistory(adminRole: AdminRole) {
    if (!backupPolicy.canViewBackups(adminRole)) {
      throw new AuthError('Unauthorized');
    }
    return backupRepository.listRestoreJobs();
  }
};
