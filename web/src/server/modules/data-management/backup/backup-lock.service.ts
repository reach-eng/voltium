/**
 * Backup lock service.
 * Manages system settings locks for backup/restore operations.
 */

import { db } from '@/lib/db';

export const backupLockService = {
  async acquireLock(status: string, owner: string): Promise<boolean> {
    const current = await db.systemSetting.findUnique({
      where: { key: 'BACKUP_LOCK_STATUS' },
    });

    if (current && current.value !== 'NONE') {
      return false;
    }

    const now = new Date().toISOString();

    await db.systemSetting.upsert({
      where: { key: 'BACKUP_LOCK_STATUS' },
      update: { value: status },
      create: {
        key: 'BACKUP_LOCK_STATUS',
        value: status,
        valueType: 'STRING',
        category: 'INTERNAL',
        isSecret: false,
        isEditable: false,
      },
    });

    await db.systemSetting.upsert({
      where: { key: 'BACKUP_LOCK_OWNER' },
      update: { value: owner },
      create: {
        key: 'BACKUP_LOCK_OWNER',
        value: owner,
        valueType: 'STRING',
        category: 'INTERNAL',
        isSecret: false,
        isEditable: false,
      },
    });

    await db.systemSetting.upsert({
      where: { key: 'BACKUP_LOCK_STARTED_AT' },
      update: { value: now },
      create: {
        key: 'BACKUP_LOCK_STARTED_AT',
        value: now,
        valueType: 'STRING',
        category: 'INTERNAL',
        isSecret: false,
        isEditable: false,
      },
    });

    return true;
  },

  async releaseLock(): Promise<void> {
    await db.systemSetting.upsert({
      where: { key: 'BACKUP_LOCK_STATUS' },
      update: { value: 'NONE' },
      create: {
        key: 'BACKUP_LOCK_STATUS',
        value: 'NONE',
        valueType: 'STRING',
        category: 'INTERNAL',
        isSecret: false,
        isEditable: false,
      },
    });

    await db.systemSetting.upsert({
      where: { key: 'BACKUP_LOCK_OWNER' },
      update: { value: '' },
      create: {
        key: 'BACKUP_LOCK_OWNER',
        value: '',
        valueType: 'STRING',
        category: 'INTERNAL',
        isSecret: false,
        isEditable: false,
      },
    });

    await db.systemSetting.upsert({
      where: { key: 'BACKUP_LOCK_STARTED_AT' },
      update: { value: '' },
      create: {
        key: 'BACKUP_LOCK_STARTED_AT',
        value: '',
        valueType: 'STRING',
        category: 'INTERNAL',
        isSecret: false,
        isEditable: false,
      },
    });
  },

  async getLockStatus(): Promise<{ status: string; startedAt?: string; owner?: string }> {
    const statusRow = await db.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_STATUS' } });
    const startedRow = await db.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_STARTED_AT' } });
    const ownerRow = await db.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_OWNER' } });

    return {
      status: statusRow?.value || 'NONE',
      startedAt: startedRow?.value,
      owner: ownerRow?.value,
    };
  },
};
