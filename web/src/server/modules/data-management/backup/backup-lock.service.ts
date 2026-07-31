/**
 * Backup lock service — minimal stub.
 * Prevents concurrent backup operations.
 */

import { db } from '@/lib/db';

export const backupLockService = {
  async acquireLock(lockType: string, owner: string): Promise<{ acquired: boolean; expiresAt: Date }> {
    const existing = await db.backupJob.findFirst({ where: { status: 'RUNNING' } });
    if (existing) {
      return { acquired: false, expiresAt: existing.startedAt ?? new Date() };
    }
    return { acquired: true, expiresAt: new Date(Date.now() + 60 * 60 * 1000) };
  },

  async releaseLock(): Promise<void> {
    // STUB: in real impl would mark lock as released
  },

  async getLockStatus(): Promise<{ locked: boolean; owner?: string; expiresAt?: Date }> {
    const existing = await db.backupJob.findFirst({ where: { status: 'RUNNING' } });
    if (existing) {
      return { locked: true, owner: 'backup-runner', expiresAt: existing.startedAt ?? new Date() };
    }
    return { locked: false };
  },
};
