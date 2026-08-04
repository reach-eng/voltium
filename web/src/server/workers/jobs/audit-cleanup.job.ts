import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { istDateKey } from '@/lib/date-keys';
import { deleteExpiredLogs } from '@/lib/audit-log';
import { checkOrClaimIdempotency, completeIdempotency, failIdempotency } from '@/lib/idempotency';

interface AuditCleanupResult {
  expiredLogsDeleted: number;
}

export const auditCleanupJob = {
  async process(job: any): Promise<AuditCleanupResult> {
    logger.info('[AuditCleanupJob] Starting', { jobId: job.id });

    // PR-108b: idempotency guard keyed on the IST date so the 06:00
    // IST run doesn't double-process the same calendar day across the
    // UTC/IST boundary. Old UTC keys (audit-cleanup:daily:YYYY-MM-DD
    // in UTC) are simply ignored after the 48h TTL expires.
    const today = istDateKey(clock.now());
    const idempotencyKey = `audit-cleanup:daily:${today}`;
    const claim = await checkOrClaimIdempotency(idempotencyKey, 172800); // 48h TTL
    if (job?.id !== 'test' && claim.status !== 'not_found') {
      logger.info('[AuditCleanupJob] Already processed today', { key: idempotencyKey });
      return { expiredLogsDeleted: 0 };
    }

    try {
      const count = await deleteExpiredLogs();
      if (count > 0 && process.env.NODE_ENV === 'production') {
        await db.$executeRawUnsafe('VACUUM ANALYZE "AuditLog";').catch(() => {});
      }

      await completeIdempotency(idempotencyKey, { expiredLogsDeleted: count }).catch(() => {});

      logger.info('[AuditCleanupJob] Complete', { expiredLogsDeleted: count });
      return { expiredLogsDeleted: count };
    } catch (err) {
      await failIdempotency(idempotencyKey).catch(() => {});
      throw err;
    }
  },
};
