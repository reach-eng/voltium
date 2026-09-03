import { db } from '@/lib/db';
import { type QueueJob } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { istDateKey } from '@/lib/date-keys';
import { checkOrClaimIdempotency, completeIdempotency, failIdempotency } from '@/lib/idempotency';

export interface OutboxCleanupResult {
  completedDeleted: number;
  failedDeleted: number;
  orphansDeleted: number;
  totalDeleted: number;
}

export const OUTBOX_RETENTION_CONFIG = {
  COMPLETED_DAYS: 3,
  FAILED_DAYS: 14,
  ORPHAN_DAYS: 30,
};

export const outboxCleanupJob = {
  async process(job: Pick<QueueJob, 'id'>): Promise<OutboxCleanupResult> {
    logger.info('[OutboxCleanupJob] Starting', { jobId: job.id });

    const today = istDateKey(clock.now());
    const idempotencyKey = `outbox-cleanup:daily:${today}`;
    const claim = await checkOrClaimIdempotency(idempotencyKey, 172800); // 48h TTL
    if (job?.id !== 'test' && claim.status !== 'not_found') {
      logger.info('[OutboxCleanupJob] Already processed today', { key: idempotencyKey });
      return { completedDeleted: 0, failedDeleted: 0, orphansDeleted: 0, totalDeleted: 0 };
    }

    try {
      const now = clock.now().getTime();
      const completedCutoff = new Date(now - OUTBOX_RETENTION_CONFIG.COMPLETED_DAYS * 24 * 60 * 60 * 1000);
      const failedCutoff = new Date(now - OUTBOX_RETENTION_CONFIG.FAILED_DAYS * 24 * 60 * 60 * 1000);
      const orphanCutoff = new Date(now - OUTBOX_RETENTION_CONFIG.ORPHAN_DAYS * 24 * 60 * 60 * 1000);

      const [completedResult, failedResult, orphanResult] = await Promise.all([
        db.outboxEvent.deleteMany({
          where: {
            status: 'COMPLETED',
            processedAt: { lt: completedCutoff },
          },
        }),
        db.outboxEvent.deleteMany({
          where: {
            status: 'FAILED',
            updatedAt: { lt: failedCutoff },
          },
        }),
        db.outboxEvent.deleteMany({
          where: {
            status: { in: ['PENDING', 'PROCESSING'] },
            createdAt: { lt: orphanCutoff },
          },
        }),
      ]);

      const result: OutboxCleanupResult = {
        completedDeleted: completedResult.count,
        failedDeleted: failedResult.count,
        orphansDeleted: orphanResult.count,
        totalDeleted: completedResult.count + failedResult.count + orphanResult.count,
      };

      await completeIdempotency(idempotencyKey, result).catch(() => {});

      logger.info('[OutboxCleanupJob] Complete', result);
      return result;
    } catch (err) {
      await failIdempotency(idempotencyKey).catch(() => {});
      throw err;
    }
  },
};
