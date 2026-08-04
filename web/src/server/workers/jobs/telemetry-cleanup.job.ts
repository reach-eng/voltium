import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { istDateKey } from '@/lib/date-keys';
import { checkOrClaimIdempotency, completeIdempotency, failIdempotency } from '@/lib/idempotency';

interface TelemetryCleanupResult {
  locationsDeleted: number;
  callLogsDeleted: number;
  contactsDeleted: number;
}

export const telemetryCleanupJob = {
  async process(job: any): Promise<TelemetryCleanupResult> {
    logger.info('[TelemetryCleanupJob] Starting', { jobId: job.id });

    // PR-108b: idempotency guard keyed on the IST date. See audit-cleanup.
    const today = istDateKey(clock.now());
    const idempotencyKey = `telemetry-cleanup:daily:${today}`;
    const claim = await checkOrClaimIdempotency(idempotencyKey, 172800); // 48h TTL
    if (claim.status !== 'not_found') {
      logger.info('[TelemetryCleanupJob] Already processed today', { key: idempotencyKey });
      return { locationsDeleted: 0, callLogsDeleted: 0, contactsDeleted: 0 };
    }

    try {
      const thirtyDaysAgo = new Date(clock.now().getTime() - 30 * 24 * 60 * 60 * 1000);

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

      await completeIdempotency(idempotencyKey, result).catch(() => {});

      logger.info('[TelemetryCleanupJob] Complete', result);
      return result;
    } catch (err) {
      await failIdempotency(idempotencyKey).catch(() => {});
      throw err;
    }
  },
};
