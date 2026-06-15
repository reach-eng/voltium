/**
 * Scheduled Backup Job
 *
 * Polls every 5 minutes for due backups based on BackupSchedule configuration.
 * Runs in the worker process as a separate polling loop.
 *
 * Flow:
 *   Load BackupSchedule → if enabled → calculate if due → create BackupJob → run backup → apply retention
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { backupRepository } from '@/server/modules/data-management/backup.repository';
import { backupService, calculateNextRun, getFreeDiskBytes } from '@/server/modules/data-management/backup.service';
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
      const maintenanceSetting = await db.setting.findUnique({ where: { key: 'maintenanceMode' } });
      if (maintenanceSetting?.value === 'true') {
        return { ran: false, reason: 'Maintenance mode is active' };
      }

      // Check backup lock — a restore operation may be in progress
      const backupLock = await db.setting.findUnique({ where: { key: 'backupLock' } });
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
        await backupRepository.markScheduleFailure(schedule.id, `Insufficient disk space: ${freeGb.toFixed(1)} GB free`);
        return { ran: false, reason: 'Insufficient disk space' };
      }

      // Check if backup is due
      const now = new Date();
      if (schedule.nextRunAt && now < schedule.nextRunAt) {
        return { ran: false, reason: `Next backup scheduled at ${schedule.nextRunAt.toISOString()}` };
      }

      // It's due — run the backup
      logger.info('[ScheduledBackup] Running scheduled backup', {
        frequency: schedule.frequency,
        timeOfDay: schedule.timeOfDay,
      });

      await createAuditLog({
        actorId: 'SYSTEM',
        actorType: 'SYSTEM',
        action: 'backup.scheduled_started',
        entity: 'BackupSchedule',
        entityId: schedule.id,
      });

      try {
        const result = await backupService.runScheduledBackup({
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
        const nextRunAt = calculateNextRun(schedule);
        await backupRepository.markScheduleSuccess(schedule.id, new Date(), nextRunAt ?? new Date());

        await createAuditLog({
          actorId: 'SYSTEM',
          actorType: 'SYSTEM',
          action: 'backup.scheduled_completed',
          entity: 'BackupJob',
          entityId: result.id,
          details: { backupId: result.backupId, sizeBytes: result.sizeBytes },
        });

        return { ran: true };
      } catch (err: any) {
        logger.error('[ScheduledBackup] Backup execution failed', { error: err.message });
        await backupRepository.markScheduleFailure(schedule.id, err.message);

        await createAuditLog({
          actorId: 'SYSTEM',
          actorType: 'SYSTEM',
          action: 'backup.scheduled_failed',
          entity: 'BackupSchedule',
          entityId: schedule.id,
          details: { error: err.message },
        });

        return { ran: false, reason: err.message };
      }
    } catch (err: any) {
      logger.error('[ScheduledBackup] Critical error in check cycle', { error: err.message });
      return { ran: false, reason: err.message };
    }
  },
};


