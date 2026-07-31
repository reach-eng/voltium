import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { backupRepository } from '@/server/modules/data-management/backup.repository';
import { scheduleService } from '@/server/modules/data-management/schedule/schedule.service';
import { getFreeDiskBytes } from '@/server/modules/data-management/backup.service';
import { createAuditLog } from '@/lib/audit-log';

export const scheduledBackupJob = {
  async checkAndRun(): Promise<{ ran: boolean; reason?: string }> {
    try {
      const schedule = await backupRepository.getSchedule();
      if (!schedule) {
        return { ran: false, reason: 'No schedule configured' };
      }

      if (!schedule.enabled) {
        return { ran: false, reason: 'Schedule is disabled' };
      }

      // Check if a backup or restore is already running
      const running = await backupRepository.findRunningBackup();
      if (running) {
        return { ran: false, reason: 'A backup is already in progress' };
      }

      // Check maintenance mode
      const maintenanceSetting = await db.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MODE' } });
      if (maintenanceSetting?.value === 'true') {
        return { ran: false, reason: 'Maintenance mode is active' };
      }

      // Check backup lock — a restore operation may be in progress
      const backupLock = await db.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_STATUS' } });
      if (backupLock?.value === 'RESTORE_RUNNING') {
        return { ran: false, reason: 'Restore operation is in progress — backup skipped' };
      }

      // Check disk space
      const freeBytes = await getFreeDiskBytes();
      const freeGb = freeBytes / (1024 * 1024 * 1024);
      if (freeGb < schedule.minimumFreeDiskGb) {
        logger.warn('[ScheduledBackup] Insufficient disk space', {
          freeGb: freeGb.toFixed(1),
          minimum: schedule.minimumFreeDiskGb,
        });
        await backupRepository.markScheduleFailure(
          schedule.id,
          `Insufficient disk space: ${freeGb.toFixed(1)} GB free`
        );
        return { ran: false, reason: 'Insufficient disk space' };
      }

      // Check if backup is due
      const now = clock.now();
      if (schedule.nextRunAt && now < schedule.nextRunAt) {
        return {
          ran: false,
          reason: `Next backup scheduled at ${schedule.nextRunAt.toISOString()}`,
        };
      }

      // It's due — run the backup
      logger.info('[ScheduledBackup] Running scheduled backup', {
        frequency: schedule.frequency,
        timeOfDay: schedule.timeOfDay,
      });

      await createAuditLog({
        actorId: 'SYSTEM',
        actorType: 'SYSTEM',
        action: 'SYSTEM_JOB',
        entity: 'BackupSchedule',
        entityId: schedule.id,
        details: { event: 'backup.scheduled_started' },
      });

      try {
        await (scheduleService as any).runScheduledBackup({
          id: schedule.id,
          frequency: schedule.frequency,
          includeDatabase: schedule.includeDatabase,
          includeUploads: schedule.includeUploads,
          includeLogs: schedule.includeLogs,
          primaryBackupRoot: schedule.primaryBackupRoot,
          secondaryBackupRoot: schedule.secondaryBackupRoot,
          keepDaily: schedule.keepDaily,
          keepWeekly: schedule.keepWeekly,
          keepMonthly: schedule.keepMonthly,
          keepManual: schedule.keepManual,
          minimumFreeDiskGb: schedule.minimumFreeDiskGb,
        });

        // Calculate next run time
        const nextRunAt = scheduleService.calculateNextRun(schedule as any);
        await backupRepository.markScheduleSuccess(
          schedule.id,
          clock.now(),
          nextRunAt ?? clock.now()
        );

        // Clear any previous failure alert
        await db.systemSetting
          .upsert({
            where: { key: 'LAST_BACKUP_FAILURE' },
            update: { value: '' },
            create: { key: 'LAST_BACKUP_FAILURE', value: '' },
          })
          .catch(() => {});

        return { ran: true };
      } catch (backupErr) {
        const errorMsg = (backupErr instanceof Error ? backupErr.message : String(backupErr));
        logger.error('[ScheduledBackup] Backup execution failed', backupErr);
        await backupRepository.markScheduleFailure(schedule.id, errorMsg);
        return { ran: false, reason: `Backup execution failed: ${errorMsg}` };
      }
    } catch (err) {
      logger.error('[ScheduledBackup] Job check failed', err);
      return { ran: false, reason: 'Job check failed' };
    }
  },
};
