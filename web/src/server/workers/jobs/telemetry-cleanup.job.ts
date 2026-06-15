import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

interface TelemetryCleanupResult {
  locationsDeleted: number;
  callLogsDeleted: number;
  contactsDeleted: number;
}

export const telemetryCleanupJob = {
  async process(job: any): Promise<TelemetryCleanupResult> {
    logger.info('[TelemetryCleanupJob] Starting', { jobId: job.id });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [locationsDeleted, callLogsDeleted, contactsDeleted] = await Promise.all([
      db.userLocation.deleteMany({ where: { timestamp: { lt: thirtyDaysAgo } } }),
      db.userCallLog.deleteMany({ where: { timestamp: { lt: thirtyDaysAgo } } }),
      db.userContact.deleteMany({ where: { createdAt: { lt: thirtyDaysAgo } } }),
    ]);

    const result: TelemetryCleanupResult = {
      locationsDeleted: locationsDeleted.count,
      callLogsDeleted: callLogsDeleted.count,
      contactsDeleted: contactsDeleted.count,
    };

    logger.info('[TelemetryCleanupJob] Complete', result);
    return result;
  },
};
