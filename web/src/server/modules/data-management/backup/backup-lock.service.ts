import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { ServerError } from "@/lib/api-error";

export const backupLockService = {
  async acquireLock(status: 'BACKUP_RUNNING' | 'RESTORE_RUNNING', owner: string): Promise<boolean> {
    try {
      return await db.$transaction(async (tx: Prisma.TransactionClient) => {
        const lockStatus = await tx.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_STATUS' } });
        const currentStatus = lockStatus?.value || 'NONE';

        if (currentStatus !== 'NONE') {
          logger.warn('[BackupService] Failed to acquire lock — lock already held', {
            currentStatus,
            owner,
          });
          return false;
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
  },

  async releaseLock(): Promise<void> {
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
  },

  async getLockStatus(): Promise<{ status: string; startedAt: string; owner: string }> {
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
  },

  async setBackupLock(locked: boolean): Promise<void> {
    if (locked) {
      const success = await this.acquireLock('RESTORE_RUNNING', 'RESTORE_SERVICE');
      if (!success) {
        throw new ServerError('Failed to acquire restore lock — a backup or restore is already running');
      }
    } else {
      await this.releaseLock();
    }
  },

  async isBackupLocked(): Promise<boolean> {
    const lock = await this.getLockStatus();
    return lock.status !== 'NONE';
  }
};
