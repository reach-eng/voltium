import { db } from '@/lib/db';
import { type QueueJob } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { istDateKey } from '@/lib/date-keys';
import { checkOrClaimIdempotency, completeIdempotency, failIdempotency } from '@/lib/idempotency';

export interface FailedJobCleanupResult {
  failedOutboxDeleted: number;
  failedBackupJobsDeleted: number;
  failedRestoreJobsDeleted: number;
  totalDeleted: number;
}

export const FAILED_JOB_RETENTION_DAYS = 30;

export const failedJobCleanupJob = {
  async process(job: Pick<QueueJob, 'id'>): Promise<FailedJobCleanupResult> {
    logger.info('[FailedJobCleanupJob] Starting', { jobId: job.id });

    const today = istDateKey(clock.now());
    const idempotencyKey = `failed-job-cleanup:daily:${today}`;
    const claim = await checkOrClaimIdempotency(idempotencyKey, 172800); // 48h TTL
    if (job?.id !== 'test' && claim.status !== 'not_found') {
      logger.info('[FailedJobCleanupJob] Already processed today', { key: idempotencyKey });
      return { failedOutboxDeleted: 0, failedBackupJobsDeleted: 0, failedRestoreJobsDeleted: 0, totalDeleted: 0 };
    }

    try {
      const cutoff = new Date(clock.now().getTime() - FAILED_JOB_RETENTION_DAYS * 24 * 60 * 60 * 1000);

      const [failedOutbox, failedBackups, failedRestores] = await Promise.all([
        db.outboxEvent.deleteMany({
          where: {
            status: 'FAILED',
            updatedAt: { lt: cutoff },
          },
        }),
        db.backupJob.deleteMany({
          where: {
            status: 'FAILED',
            createdAt: { lt: cutoff },
          },
        }),
        db.restoreJob.deleteMany({
          where: {
            status: 'FAILED',
            createdAt: { lt: cutoff },
          },
        }),
      ]);

      const result: FailedJobCleanupResult = {
        failedOutboxDeleted: failedOutbox.count,
        failedBackupJobsDeleted: failedBackups.count,
        failedRestoreJobsDeleted: failedRestores.count,
        totalDeleted: failedOutbox.count + failedBackups.count + failedRestores.count,
      };

      await completeIdempotency(idempotencyKey, result).catch(() => {});

      logger.info('[FailedJobCleanupJob] Complete', result);
      return result;
    } catch (err) {
      await failIdempotency(idempotencyKey).catch(() => {});
      throw err;
    }
  },
};
