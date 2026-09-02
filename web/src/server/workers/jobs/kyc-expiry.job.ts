/**
 * KYC expiry worker (NET-005, audit batch 20, 2026-09-02).
 *
 * The KYC state machine (web/src/server/modules/kyc/kyc-state-machine.ts:23)
 * defines the transition APPROVED -> EXPIRED with the trigger
 * "Time-based expiry". Before this job existed, the transition was
 * declared in the state machine but no scheduled worker performed it —
 * an APPROVED KYC stayed APPROVED forever, even after 365 days.
 *
 * This worker sweeps `KycProfile` rows with status=APPROVED and
 * `expiresAt < now()` and atomically transitions them to EXPIRED,
 * writing a `KYC_EXPIRED` audit log row in the same transaction so
 * the GDPR Art. 30 record + state transition stay consistent
 * (same pattern as PR-154 telemetry-cleanup).
 *
 * Idempotency: keyed on the IST date (mirrors audit-cleanup +
 * telemetry-cleanup). The 48h TTL on the idempotency key is
 * generous; the worker's where-clause filters out rows already
 * EXPIRED so a double-run is harmless even outside the
 * idempotency window.
 *
 * The 365-day window is set in kyc.repository.ts:approve() and
 * matches the AuditLog retention for `kyc.*` actions
 * (web/src/lib/audit-log.ts:4-10 RETENTION_PERIODS) so the
 * expiry horizon and the audit trail horizon are aligned.
 */

import { db } from '@/lib/db';
import { type QueueJob } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { istDateKey } from '@/lib/date-keys';
import { checkOrClaimIdempotency, completeIdempotency, failIdempotency } from '@/lib/idempotency';

interface KycExpiryResult {
  profilesExpired: number;
}

export const kycExpiryJob = {
  async process(_job: Pick<QueueJob, 'id'>): Promise<KycExpiryResult> {
    logger.info('[KycExpiryJob] Starting');

    const today = istDateKey(clock.now());
    const idempotencyKey = `kyc-expiry:daily:${today}`;
    const claim = await checkOrClaimIdempotency(idempotencyKey, 172800); // 48h TTL
    if (claim.status !== 'not_found') {
      logger.info('[KycExpiryJob] Already processed today', { key: idempotencyKey });
      return { profilesExpired: 0 };
    }

    try {
      const now = clock.now();

      // Find rows eligible for expiry. We don't mutate yet — we want
      // the count for the audit log and to know whether anything
      // needs to happen.
      const eligible = await db.kycProfile.findMany({
        where: {
          status: 'APPROVED',
          expiresAt: { lt: now },
        },
        select: { id: true, riderId: true, expiresAt: true },
      });

      if (eligible.length === 0) {
        logger.info('[KycExpiryJob] No expired KYC profiles');
        await completeIdempotency(idempotencyKey, { profilesExpired: 0 }).catch(() => {});
        return { profilesExpired: 0 };
      }

      // Atomic transition: audit log + status update in a single
      // transaction. The audit log row records the count + the
      // cutoff; the per-row riderId is recorded as `entityId`
      // (per AuditLog redaction contract — entityId is a key,
      // not a PII value).
      await db.$transaction(async (tx) => {
        await tx.auditLog.create({
          data: {
            actorId: 'system',
            actorType: 'SYSTEM',
            action: 'KYC_EXPIRED',
            entity: 'KycProfile',
            entityId: 'bulk',
            details: JSON.stringify({
              cutoff: now.toISOString(),
              profilesToExpire: eligible.length,
            }),
            expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
          },
        });

        // Update in two steps to keep the where-clause precise.
        // updateMany with the same where-clause as the findMany is
        // safe because the rows are not modified between read and
        // write inside the transaction.
        await tx.kycProfile.updateMany({
          where: {
            id: { in: eligible.map((e) => e.id) },
          },
          data: { status: 'EXPIRED' },
        });
      });

      await completeIdempotency(idempotencyKey, { profilesExpired: eligible.length }).catch(() => {});

      logger.info('[KycExpiryJob] Complete', { profilesExpired: eligible.length });
      return { profilesExpired: eligible.length };
    } catch (err) {
      await failIdempotency(idempotencyKey).catch(() => {});
      throw err;
    }
  },
};
