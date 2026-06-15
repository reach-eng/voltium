import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { deleteExpiredLogs } from '@/lib/audit-log';

interface AuditCleanupResult {
  expiredLogsDeleted: number;
}

export const auditCleanupJob = {
  async process(job: any): Promise<AuditCleanupResult> {
    logger.info('[AuditCleanupJob] Starting', { jobId: job.id });

    const count = await deleteExpiredLogs();

    logger.info('[AuditCleanupJob] Complete', { expiredLogsDeleted: count });
    return { expiredLogsDeleted: count };
  },
};
