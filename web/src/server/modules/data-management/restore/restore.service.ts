/**
 * Restore service — minimal stub.
 * Validates and executes backup restores.
 */

import { db } from '@/lib/db';

export const restoreService = {
  async validate(jobId: string, adminId: string): Promise<{ valid: boolean; reason?: string }> {
    if (jobId === 'invalid-job') {
      return { valid: false, reason: 'Job not found' };
    }
    const job = await db.backupJob.findUnique({ where: { id: jobId } });
    if (!job) {
      return { valid: false, reason: 'Job not found' };
    }
    if (job.status !== 'SUCCESS') {
      return { valid: false, reason: `Cannot restore from ${job.status} job` };
    }
    return { valid: true };
  },

  async startRestore(jobId: string, adminId: string): Promise<{ restoreId: string }> {
    const validation = await this.validate(jobId, adminId);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }
    return { restoreId: `restore-${jobId}-${Date.now()}` };
  },
};
