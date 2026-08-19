import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { type QueueJob } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { istDateKey } from '@/lib/date-keys';
import { checkOrClaimIdempotency, completeIdempotency, failIdempotency } from '@/lib/idempotency';
import { createAuditLog } from '@/lib/audit-log';

interface TelemetryCleanupResult {
  locationsDeleted: number;
  callLogsDeleted: number;
  contactsDeleted: number;
}

export const telemetryCleanupJob = {
  async process(job: Pick<QueueJob, 'id'>): Promise<TelemetryCleanupResult> {
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

      // PR-154: count BEFORE delete so the audit log carries the
      // exact number of PII records destroyed. GDPR Art. 30 requires
      // a record of processing activity — deleting PII without an
      // audit trail is a violation.
      const [locationsCount, callLogsCount, contactsCount] = await Promise.all([
        db.userLocation.count({ where: { timestamp: { lt: thirtyDaysAgo } } }),
        db.userCallLog.count({ where: { timestamp: { lt: thirtyDaysAgo } } }),
        db.userContact.count({ where: { createdAt: { lt: thirtyDaysAgo } } }),
      ]);

      // P0-3: audit log + deletes must be atomic. If deletes fail,
      // the audit row must not exist (it would claim deletion happened).
      // We write directly to tx.auditLog instead of the createAuditLog
      // helper (which uses the module-level `db` client, not the tx).
      const [locationsDeleted, callLogsDeleted, contactsDeleted] =
        await db.$transaction(async (tx) => {
          await tx.auditLog.create({
            data: {
              actorId: 'system',
              actorType: 'SYSTEM',
              action: 'telemetry.cleanup',
              entity: 'telemetry',
              entityId: 'bulk',
              details: JSON.stringify({
                cutoff: thirtyDaysAgo.toISOString(),
                locationsToDelete: locationsCount,
                callLogsToDelete: callLogsCount,
                contactsToDelete: contactsCount,
              }),
            },
          });

          const [loc, call, contact] = await Promise.all([
            tx.userLocation.deleteMany({ where: { timestamp: { lt: thirtyDaysAgo } } }),
            tx.userCallLog.deleteMany({ where: { timestamp: { lt: thirtyDaysAgo } } }),
            tx.userContact.deleteMany({ where: { createdAt: { lt: thirtyDaysAgo } } }),
          ]);
          return [loc.count, call.count, contact.count];
        });

      const result: TelemetryCleanupResult = {
        locationsDeleted,
        callLogsDeleted,
        contactsDeleted,
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
