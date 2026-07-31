import { backupRepository } from '../backup/backup.repository';
import { backupPolicy } from '../backup/backup.policy';
import { getStorageOverview } from '../storage/storage.service';
import type { AdminRole } from '../../admin/admin.types';
import { db } from '@/lib/db';
import { AuthError } from "@/lib/api-error";

export const overviewUseCases = {
  async getOverview(adminRole: AdminRole) {
    if (!backupPolicy.canViewBackups(adminRole)) {
      throw new AuthError('Unauthorized');
    }

    const [stats, latestBackup, storage] = await Promise.all([
      backupRepository.getBackupStats(),
      backupRepository.getLatestBackup(),
      getStorageOverview(),
    ]);

    let maintenanceMode = false;
    try {
      const setting = await db.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MODE' } });
      maintenanceMode = setting?.value === 'true';
    } catch {}

    let scheduleStatus = null;
    try {
      const schedule = await backupRepository.getSchedule();
      if (schedule) {
        scheduleStatus = {
          enabled: schedule.enabled,
          nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
          lastRunAt: schedule.lastRunAt?.toISOString() ?? null,
          lastStatus: schedule.lastStatus,
          lastError: schedule.lastError,
        };
      }
    } catch {}

    return { stats, latestBackup, storage, maintenanceMode, scheduleStatus };
  }
};
