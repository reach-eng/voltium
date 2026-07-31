import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit-log';
import { backupRepository } from '../backup/backup.repository';
import { db } from '@/lib/db';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { getBackupRootAsync, getSecondaryRootAsync } from '../storage/storage.service';
import { backupService } from '../backup/backup.service';
import { ValidationError } from "@/lib/api-error";
import { getFreeDiskBytes } from '../storage/storage.service';

export const scheduleService = {
  async applyRetentionPolicy(policy: {
    keepDaily: number;
    keepWeekly: number;
    keepMonthly: number;
    keepManual: number | null;
    frequency: string;
  }) {
    const now = new Date();
    let totalDeleted = 0;

    const dailyCutoff = new Date(now);
    dailyCutoff.setDate(dailyCutoff.getDate() - policy.keepDaily * 2);
    totalDeleted += await scheduleService.purgeOldBackupsByType(
      'DAILY',
      dailyCutoff,
      policy.keepDaily
    );

    const weeklyCutoff = new Date(now);
    weeklyCutoff.setDate(weeklyCutoff.getDate() - policy.keepWeekly * 14);
    totalDeleted += await scheduleService.purgeOldBackupsByType(
      'WEEKLY',
      weeklyCutoff,
      policy.keepWeekly
    );

    const monthlyCutoff = new Date(now);
    monthlyCutoff.setMonth(monthlyCutoff.getMonth() - 12);
    totalDeleted += await scheduleService.purgeOldBackupsByType(
      'MONTHLY',
      monthlyCutoff,
      policy.keepMonthly
    );

    if (policy.keepManual !== null) {
      totalDeleted += await scheduleService.purgeOldBackupsByType(
        'MANUAL',
        new Date(0),
        policy.keepManual
      );
    }

    if (totalDeleted > 0) {
      logger.info('[ScheduleService] Retention policy applied', { deletedCount: totalDeleted });
    }

    return totalDeleted;
  },

  async purgeOldBackupsByType(type: string, olderThan: Date, keepCount: number): Promise<number> {
    const oldJobs = await db.backupJob.findMany({
      where: { scheduleType: type, createdAt: { lt: olderThan }, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      skip: keepCount,
      select: { id: true, backupPath: true },
    });

    if (oldJobs.length === 0) return 0;

    const secondaryRoot = await getSecondaryRootAsync();
    const primaryRoot = await getBackupRootAsync();
    let purgedCount = 0;

    for (const job of oldJobs) {
      try {
        if (job.backupPath && existsSync(job.backupPath)) {
          rmSync(job.backupPath, { recursive: true, force: true });
        }

        if (secondaryRoot && job.backupPath) {
          const relativePath = job.backupPath.replace(primaryRoot, '');
          const secondaryPath = join(secondaryRoot, relativePath);
          if (existsSync(secondaryPath)) {
            rmSync(secondaryPath, { recursive: true, force: true });
          }
        }

        await backupRepository.deleteBackupJob(job.id);

        await createAuditLog({
          actorId: 'SYSTEM',
          actorType: 'SYSTEM',
          action: 'backup.retention_purged',
          entity: 'BackupJob',
          entityId: job.id,
          details: { type, backupPath: job.backupPath },
        });

        purgedCount++;
      } catch (err) {
        logger.error('[ScheduleService] Failed to purge old backup', {
          jobId: job.id,
          backupPath: job.backupPath,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('[ScheduleService] Purged old backups', { type, count: purgedCount });
    return purgedCount;
  },

  async runScheduledBackup(schedule: {
    id: string;
    frequency: string;
    includeDatabase: boolean;
    includeUploads: boolean;
    includeLogs: boolean;
    primaryBackupRoot: string;
    secondaryBackupRoot: string | null;
    keepDaily: number;
    keepWeekly: number;
    keepMonthly: number;
    keepManual: number | null;
    minimumFreeDiskGb: number;
  }) {
    const { minimumFreeDiskGb } = schedule;
    const freeBytes = getFreeDiskBytes();
    const freeGb = freeBytes / (1024 * 1024 * 1024);
    if (freeGb < minimumFreeDiskGb) {
      throw new ValidationError(
        `Insufficient disk space: ${freeGb.toFixed(1)} GB free, need ${minimumFreeDiskGb} GB`
      );
    }

    const originalRoot = process.env.BACKUP_ROOT;
    process.env.BACKUP_ROOT = schedule.primaryBackupRoot;
    if (schedule.secondaryBackupRoot) {
      process.env.BACKUP_SECONDARY_ROOT = schedule.secondaryBackupRoot;
    }

    try {
      const result = await backupService.createBackup({
        type: 'SCHEDULED',
        scheduleType: schedule.frequency,
      });

      await scheduleService.applyRetentionPolicy({
        keepDaily: schedule.keepDaily,
        keepWeekly: schedule.keepWeekly,
        keepMonthly: schedule.keepMonthly,
        keepManual: schedule.keepManual,
        frequency: schedule.frequency,
      });

      return result;
    } finally {
      process.env.BACKUP_ROOT = originalRoot;
    }
  },

  calculateNextRun(config: {
    frequency: string;
    timeOfDay: string;
    timezone?: string;
    dayOfWeek: number | null;
    dayOfMonth: number | null;
  }): Date | null {
    if (!config.frequency || config.frequency === 'MANUAL') return null;

    const now = new Date();
    const [hours, minutes] = config.timeOfDay.split(':').map(Number);

    const next = new Date(now);
    const hoursVal = hours !== undefined && !isNaN(hours) ? hours : 2;
    const minutesVal = minutes !== undefined && !isNaN(minutes) ? minutes : 0;
    next.setHours(hoursVal, minutesVal, 0, 0);

    if (config.frequency === 'MONTHLY') {
      const targetDay = Math.min(config.dayOfMonth ?? 1, 28);
      next.setDate(targetDay);
      if (next <= now) {
        next.setMonth(next.getMonth() + 1);
        next.setDate(targetDay);
      }
    } else if (next <= now) {
      switch (config.frequency) {
        case 'DAILY':
          next.setDate(next.getDate() + 1);
          break;
        case 'WEEKLY': {
          const targetDay = config.dayOfWeek ?? 0;
          const daysUntil = (targetDay - next.getDay() + 7) % 7;
          next.setDate(next.getDate() + (daysUntil || 7));
          break;
        }
      }
    }

    return next;
  }
};
