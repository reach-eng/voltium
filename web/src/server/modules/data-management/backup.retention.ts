/**
 * Data Management — Backup Retention
 *
 * Retention policy enforcement and purge of aged backups.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit-log';
import { backupRepository } from './backup.repository';
import { existsSync } from 'fs';
import { join } from 'path';
import { safeRmBackupPath } from './backup.validation';
import { getBackupRootAsync, getSecondaryRootAsync } from './backup.storage';

export async function purgeOldBackupsByType(type: string, olderThan: Date, keepCount: number): Promise<number> {
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
        safeRmBackupPath(job.backupPath);
      }

      if (secondaryRoot && job.backupPath) {
        const relativePath = job.backupPath.replace(primaryRoot, '');
        const secondaryPath = join(secondaryRoot, relativePath);
        if (existsSync(secondaryPath)) {
          safeRmBackupPath(secondaryPath);
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
      logger.error('[BackupService] Failed to purge old backup', {
        jobId: job.id,
        backupPath: job.backupPath,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('[BackupService] Purged old backups', { type, count: purgedCount });
  return purgedCount;
}

export async function applyRetentionPolicy(policy: {
  keepDaily: number;
  keepWeekly: number;
  keepMonthly: number;
  keepManual: number | null;
  frequency: string;
}): Promise<number> {
  const now = new Date();
  let totalDeleted = 0;

  const dailyCutoff = new Date(now);
  dailyCutoff.setDate(dailyCutoff.getDate() - policy.keepDaily * 2);
  totalDeleted += await purgeOldBackupsByType('DAILY', dailyCutoff, policy.keepDaily);

  const weeklyCutoff = new Date(now);
  weeklyCutoff.setDate(weeklyCutoff.getDate() - policy.keepWeekly * 14);
  totalDeleted += await purgeOldBackupsByType('WEEKLY', weeklyCutoff, policy.keepWeekly);

  const monthlyCutoff = new Date(now);
  monthlyCutoff.setMonth(monthlyCutoff.getMonth() - 12);
  totalDeleted += await purgeOldBackupsByType('MONTHLY', monthlyCutoff, policy.keepMonthly);

  if (policy.keepManual !== null) {
    totalDeleted += await purgeOldBackupsByType('MANUAL', new Date(0), policy.keepManual);
  }

  if (totalDeleted > 0) {
    logger.info('[BackupService] Retention policy applied', { deletedCount: totalDeleted });
  }

  return totalDeleted;
}
