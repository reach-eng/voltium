import { backupRepository } from './backup.repository';
import { backupService } from './backup.service';
import { backupPolicy } from './backup.policy';
import type { AdminRole } from '../../admin/admin.types';
import { AuthError, NotFoundError } from "@/lib/api-error";
import { createAuditLog } from '@/lib/audit-log';

export const backupUseCases = {
  async listBackups(params: {
    page: number;
    limit: number;
    type?: string;
    status?: string;
    adminRole: AdminRole;
  }) {
    if (!backupPolicy.canViewBackups(params.adminRole)) {
      throw new AuthError('Unauthorized');
    }

    return backupRepository.listBackupJobs({
      page: params.page,
      limit: params.limit,
      type: params.type,
      status: params.status,
    });
  },

  async createBackup(params: {
    type: 'MANUAL' | 'SCHEDULED' | 'PRE_RESTORE';
    adminId?: string;
    adminRole: AdminRole;
  }) {
    if (!backupPolicy.canCreateBackup(params.adminRole)) {
      throw new AuthError('Unauthorized');
    }

    return backupService.createBackup({
      type: params.type,
      adminId: params.adminId,
    });
  },

  async getBackupDetails(backupId: string, adminRole: AdminRole) {
    if (!backupPolicy.canViewBackups(adminRole)) {
      throw new AuthError('Unauthorized');
    }

    const job = await backupRepository.getBackupJob(backupId);
    if (!job) throw new NotFoundError('Backup not found');

    return job;
  },

  async verifyBackup(backupId: string, adminRole: AdminRole) {
    if (!backupPolicy.canViewBackups(adminRole)) {
      throw new AuthError('Unauthorized');
    }

    return backupService.verifyBackup(backupId);
  },

  async downloadBackup(backupId: string, adminRole: AdminRole) {
    if (!backupPolicy.canDownloadBackup(adminRole)) {
      throw new AuthError('Unauthorized');
    }

    const job = await backupRepository.getBackupJob(backupId);
    if (!job) throw new NotFoundError('Backup not found');
    const { existsSync } = await import('fs');
    if (!job.databasePath || !existsSync(job.databasePath)) {
      throw new NotFoundError('Backup files not found on disk');
    }

    return job;
  },

  async deleteBackup(backupId: string, adminRole: AdminRole, adminId: string) {
    if (!backupPolicy.canDeleteBackup(adminRole)) {
      throw new AuthError('Unauthorized');
    }

    await backupService.deleteBackup(backupId);

    await createAuditLog({
      actorId: adminId,
      actorType: 'ADMIN',
      action: 'backup.deleted',
      entity: 'BackupJob',
      entityId: backupId,
    });
  }
};
