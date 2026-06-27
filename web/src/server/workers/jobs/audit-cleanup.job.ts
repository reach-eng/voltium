import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { deleteExpiredLogs } from '@/lib/audit-log';
import { checkOrClaimIdempotency, completeIdempotency, failIdempotency } from '@/lib/idempotency';

interface AuditCleanupResult {
  expiredLogsDeleted: number;
}

export const auditCleanupJob = {
  async process(job: any): Promise<AuditCleanupResult> {
    logger.info('[AuditCleanupJob] Starting', { jobId: job.id });

    // Idempotency guard — one run per day
    const today = new Date().toISOString().split('T')[0];
    const idempotencyKey = `audit-cleanup:daily:${today}`;
    const claim = await checkOrClaimIdempotency(idempotencyKey, 172800); // 48h TTL
    if (claim.status !== 'not_found') {
      logger.info('[AuditCleanupJob] Already processed today', { key: idempotencyKey });
      return { expiredLogsDeleted: 0 };
    }

    try {
      const count = await deleteExpiredLogs();

      await completeIdempotency(idempotencyKey, { expiredLogsDeleted: count }).catch(() => {});

      logger.info('[AuditCleanupJob] Complete', { expiredLogsDeleted: count });
      return { expiredLogsDeleted: count };
    } catch (err) {
      await failIdempotency(idempotencyKey).catch(() => {});
      throw err;
    }
  },
};
