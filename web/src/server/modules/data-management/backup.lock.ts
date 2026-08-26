/**
 * Data Management — Backup Lock
 *
 * Distributed lock management and stale job recovery for backup & restore operations.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function acquireLock(status: 'BACKUP_RUNNING' | 'RESTORE_RUNNING', owner: string): Promise<boolean> {
  try {
    return await db.$transaction(async (tx) => {
      const lockStatus = await tx.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_STATUS' } });
      const currentStatus = lockStatus?.value || 'NONE';

      if (currentStatus !== 'NONE') {
        const startedAtSetting = await tx.systemSetting.findUnique({
          where: { key: 'BACKUP_LOCK_STARTED_AT' },
        });
        const startedAt = startedAtSetting?.value ? new Date(startedAtSetting.value).getTime() : 0;
        const LOCK_TTL_MS = 30 * 60 * 1000;
        const isExpired = startedAt > 0 && Date.now() - startedAt > LOCK_TTL_MS;

        if (!isExpired) {
          logger.warn('[BackupService] Failed to acquire lock — lock already held', {
            currentStatus,
            owner,
            startedAt: startedAtSetting?.value,
          });
          return false;
        }

        logger.warn('[BackupService] Overriding expired backup lock (TTL exceeded)', {
          currentStatus,
          heldSince: startedAtSetting?.value,
          ttlMinutes: LOCK_TTL_MS / 60000,
        });
      }

      await Promise.all([
        tx.systemSetting.upsert({
          where: { key: 'BACKUP_LOCK_STATUS' },
          update: { value: status },
          create: { key: 'BACKUP_LOCK_STATUS', value: status, valueType: 'STRING', category: 'INTERNAL', isSecret: false, isEditable: false },
        }),
        tx.systemSetting.upsert({
          where: { key: 'BACKUP_LOCK_STARTED_AT' },
          update: { value: new Date().toISOString() },
          create: { key: 'BACKUP_LOCK_STARTED_AT', value: new Date().toISOString(), valueType: 'STRING', category: 'INTERNAL', isSecret: false, isEditable: false },
        }),
        tx.systemSetting.upsert({
          where: { key: 'BACKUP_LOCK_OWNER' },
          update: { value: owner },
          create: { key: 'BACKUP_LOCK_OWNER', value: owner, valueType: 'STRING', category: 'INTERNAL', isSecret: false, isEditable: false },
        }),
      ]);

      logger.info('[BackupService] Lock acquired successfully', { status, owner });
      return true;
    });
  } catch (err: unknown) {
    logger.error('[BackupService] Error acquiring lock', err);
    return false;
  }
}

export async function releaseLock(): Promise<void> {
  try {
    await Promise.all([
      db.systemSetting.upsert({
        where: { key: 'BACKUP_LOCK_STATUS' },
        update: { value: 'NONE' },
        create: { key: 'BACKUP_LOCK_STATUS', value: 'NONE', valueType: 'STRING', category: 'INTERNAL', isSecret: false, isEditable: false },
      }),
      db.systemSetting.upsert({
        where: { key: 'BACKUP_LOCK_STARTED_AT' },
        update: { value: '' },
        create: { key: 'BACKUP_LOCK_STARTED_AT', value: '', valueType: 'STRING', category: 'INTERNAL', isSecret: false, isEditable: false },
      }),
      db.systemSetting.upsert({
        where: { key: 'BACKUP_LOCK_OWNER' },
        update: { value: '' },
        create: { key: 'BACKUP_LOCK_OWNER', value: '', valueType: 'STRING', category: 'INTERNAL', isSecret: false, isEditable: false },
      }),
    ]);
    logger.info('[BackupService] Lock released successfully');
  } catch (err: unknown) {
    logger.error('[BackupService] Error releasing lock', err);
  }
}

export async function getLockStatus(): Promise<{ status: string; startedAt: string; owner: string }> {
  try {
    const [statusSetting, startedSetting, ownerSetting] = await Promise.all([
      db.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_STATUS' } }),
      db.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_STARTED_AT' } }),
      db.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_OWNER' } }),
    ]);

    return {
      status: statusSetting?.value || 'NONE',
      startedAt: startedSetting?.value || '',
      owner: ownerSetting?.value || '',
    };
  } catch {
    return { status: 'NONE', startedAt: '', owner: '' };
  }
}

export async function setBackupLock(locked: boolean): Promise<void> {
  if (locked) {
    const success = await acquireLock('RESTORE_RUNNING', 'RESTORE_SERVICE');
    if (!success) {
      throw new Error('Failed to acquire restore lock — a backup or restore is already running');
    }
  } else {
    await releaseLock();
  }
}

export async function isBackupLocked(): Promise<boolean> {
  const lock = await getLockStatus();
  return lock.status !== 'NONE';
}

export async function reapStaleBackupJobs(maxAgeMinutes = 60): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  const staleJobs = await db.backupJob.updateMany({
    where: {
      status: { in: ['RUNNING', 'QUEUED'] },
      createdAt: { lt: cutoff },
    },
    data: {
      status: 'FAILED',
      errorMessage: `Timed out: abandoned in RUNNING/QUEUED state older than ${maxAgeMinutes} minutes`,
    },
  });
  if (staleJobs.count > 0) {
    logger.warn('[BackupService] Reaped stale backup jobs', { count: staleJobs.count });
  }
  return staleJobs.count;
}
