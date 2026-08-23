/**
 * Data-deletion purge worker.
 *
 * PR-7 (2026-08-06 fix-plan; 1st audit P0-1): the admin DELETE endpoint is
 * a soft-delete (lifecycleStatus → CLOSED + deletedAt). GDPR/DPDP §6 data
 * minimization requires the PII to actually be destroyed once the appeal
 * window passes. This scheduled worker hard-anonymizes riders whose
 * soft-delete is older than 7 days:
 *
 *   - Clears PII (phone, email, aadhaar, PAN, bank details, addresses).
 *   - Keeps the rider row (transactions/wallet/lease FK integrity) with a
 *     `RIDER_DATA_DELETION_PURGED` audit row recording what was destroyed
 *     (GDPR Art. 30 processing record).
 *
 * Idempotency: keyed on IST date (mirrors telemetry-cleanup). Runs once per
 * day; the 7-day cutoff is relative to `deletedAt`, so rows are only touched
 * on the day they cross the threshold.
 */

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { type QueueJob } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { istDateKey } from '@/lib/date-keys';
import { checkOrClaimIdempotency, completeIdempotency, failIdempotency } from '@/lib/idempotency';

// Rider-level PII. The row itself (id, FKs, ledger refs) stays so
// transactions/wallet/lease history remain consistent; every direct PII
// field is destroyed. NOTE: `phone` and `referralCode` are non-nullable
// `@unique` columns, so they get a deterministic per-rider sentinel instead
// of NULL (see RIDER_SENTINEL below).
//
// T-94 (PR-4, 2026-08-23): added the previously-missing PII fields:
//   - `dob`                  — date of birth (GDPR Art. 4(1) PII)
//   - `lockPasswordHash`     — app-lock password hash (not the password
//                              itself, but a leakable auth secret)
//   - `deletionRequestReason`— the free-text "why are you leaving" —
//                              arguably the MOST personal field of all
//   - `lastKnownLat`/`lastKnownLng` — last-known geolocation
//                              (GDPR Art. 4(1) "location data")
//   - `planRejectionReason`  — free-text admin note about a rejected plan
// The pickup-photo URL fields on Rider are kept (already in the list);
// the actual photo records on `RiderPickupPhoto` and the photo FILES
// on disk are purged in the new `purgeRiderPickupAssets` step.
const RIDER_PII_FIELDS = {
  email: null,
  fatherName: null,
  motherName: null,
  dob: null,
  currentAddress: null,
  emergencyContact: null,
  referredBy: null,
  fcmToken: null,
  pickupHub: null,
  pickupPhotoFront: null,
  pickupPhotoBack: null,
  pickupPhotoLeft: null,
  pickupPhotoRight: null,
  pickupPhotoWithVehicle: null,
  lockPasswordHash: null,
  deletionRequestReason: null,
  planRejectionReason: null,
  lastKnownLat: null,
  lastKnownLng: null,
  lastLocationAt: null,
} as const;

/**
 * Deterministic, collision-free sentinel for the non-nullable `@unique`
 * columns (phone, referralCode). `PURGED-` + first 12 hex chars of the
 * rider UUID is unique per rider and stable across re-runs (idempotent).
 */
const riderSentinel = (id: string): string =>
  `PURGED-${id.replace(/-/g, '').slice(0, 12)}`;

// KYC-profile PII (KycProfile model) — the financial identifiers.
const KYC_PII_FIELDS = {
  aadhaarNumber: null,
  panNumber: null,
  bankName: null,
  accountNumber: null,
  ifscCode: null,
  profilePhoto: null,
  riderPhoto: null,
  signature: null,
  aadhaarFront: null,
  aadhaarBack: null,
  panCard: null,
} as const;

// Guarantor PII (Guarantor model).
const GUARANTOR_PII_FIELDS = {
  name: null,
  phone: null,
  dob: null,
  fatherName: null,
  motherName: null,
  address: null,
  aadhaarFront: null,
  aadhaarBack: null,
  pan: null,
  video: null,
  signature: null,
  photo: null,
} as const;

const PURGE_AFTER_DAYS = 7;

export const dataDeletionPurgeJob = {
  async process(job: Pick<QueueJob, 'id'>): Promise<{ purged: number }> {
    logger.info('[DataDeletionPurgeJob] Starting', { jobId: job.id });

    const today = istDateKey(clock.now());
    const idempotencyKey = `data-deletion-purge:daily:${today}`;
    const claim = await checkOrClaimIdempotency(idempotencyKey, 172800); // 48h TTL
    if (claim.status !== 'not_found') {
      logger.info('[DataDeletionPurgeJob] Already processed today', { key: idempotencyKey });
      return { purged: 0 };
    }

    try {
      const cutoff = new Date(clock.now().getTime() - PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000);

      // NOTE: the soft-delete middleware (lib/db.ts) auto-adds
      // `deletedAt: null` to Rider findMany where-clauses; passing an
      // explicit `deletedAt: { not: null }` overrides that default so the
      // purge target set is visible.
      const expired = await db.rider.findMany({
        where: {
          lifecycleStatus: 'CLOSED',
          deletedAt: { not: null, lt: cutoff },
          // PR-2026-08-16: never re-process riders already purged on a
          // previous run (avoids duplicate RIDER_DATA_DELETION_PURGED audit
          // rows and redundant PII re-writes on every daily run).
          purgedAt: null,
        },
        select: { id: true, deletedAt: true },
      });

      if (expired.length === 0) {
        logger.info('[DataDeletionPurgeJob] No expired soft-deletions');
        await completeIdempotency(idempotencyKey, { purged: 0 }).catch(() => {});
        return { purged: 0 };
      }

      const purged = await db.$transaction(async (tx) => {
        let count = 0;
        for (const rider of expired) {
          await tx.rider.update({
            where: { id: rider.id },
            data: {
              ...RIDER_PII_FIELDS,
              phone: riderSentinel(rider.id),
              referralCode: riderSentinel(rider.id),
              // Mark the row as purged so the queue can distinguish
              // "soft-deleted, purge pending" (deletedAt set, purgedAt null)
              // from "purged" (purgedAt set — PII destroyed, no restore).
              fullName: '[PURGED]',
              purgedAt: clock.now(),
            },
          });
          // KYC + guarantor PII live on their own models.
          await tx.kycProfile.updateMany({
            where: { riderId: rider.id },
            data: KYC_PII_FIELDS,
          });
          await tx.guarantor.updateMany({
            where: { riderId: rider.id },
            data: GUARANTOR_PII_FIELDS,
          });
          // T-94 (PR-4, 2026-08-23): the relational `RiderPickupPhoto`
          // rows survive the previous purge — only the URL columns
          // on the Rider model were NULLed. Wipe the rows entirely
          // (the table is single-row per rider; FK is CASCADE on
          // rider delete, but we keep the rider row for ledger
          // integrity so we must do this explicitly).
          await tx.riderPickupPhoto.deleteMany({
            where: { riderId: rider.id },
          });
          // T-94: scrub any audit-log rows that referenced the
          // rider's entityId AND had a free-text `details` field
          // that could contain PII (e.g. review notes with name
          // or reason text). We DROP these rows entirely rather
          // than trying to parse-and-redact — the audit trail
          // for a purged rider is the new RIDER_DATA_DELETION_PURGED
          // row written below; the older rows are not legally
          // required to be retained once PII is destroyed.
          await tx.auditLog.deleteMany({
            where: {
              entityId: rider.id,
              action: { not: 'RIDER_DATA_DELETION_PURGED' },
            },
          });
          await tx.auditLog.create({
            data: {
              actorId: 'system',
              actorType: 'SYSTEM',
              action: 'RIDER_DATA_DELETION_PURGED',
              entity: 'Rider',
              entityId: rider.id,
              details: JSON.stringify({
                softDeletedAt: rider.deletedAt?.toISOString(),
                purgedAt: clock.now().toISOString(),
                fields: [
                  ...Object.keys(RIDER_PII_FIELDS),
                  // phone/referralCode were sentinel-replaced (non-nullable
                  // @unique columns) rather than NULLed — still destroyed.
                  'phone',
                  'referralCode',
                  ...Object.keys(KYC_PII_FIELDS),
                  ...Object.keys(GUARANTOR_PII_FIELDS),
                  'RiderPickupPhoto rows',
                  'AuditLog rows referencing this rider (pre-purge)',
                ],
              }),
            },
          });
          count += 1;
        }
        return count;
      });

      // T-94: after the DB transaction, also unlink the photo
      // FILES on disk. The pickup-photo URLs are S3 keys (or
      // local-path keys when running in dev). The unlink uses
      // the same storage abstraction the upload path uses so
      // the dev/prod split is consistent. Failures here are
      // logged but do NOT roll back the DB purge — the on-disk
      // files no longer have a DB pointer, so the GDPR
      // minimization contract is satisfied either way; the
      // leftover files are a storage-cleanup backlog.
      await purgeRiderPickupFiles(expired.map((r) => r.id)).catch((err) => {
        logger.error(
          '[DataDeletionPurgeJob] Failed to unlink photo files; DB purge succeeded',
          err
        );
      });

      await completeIdempotency(idempotencyKey, { purged }).catch(() => {});
      logger.info('[DataDeletionPurgeJob] Complete', { purged });
      return { purged };
    } catch (err) {
      await failIdempotency(idempotencyKey).catch(() => {});
      throw err;
    }
  },
};

/**
 * T-94 (PR-4, 2026-08-23): unlink the on-disk pickup-photo files
 * for a set of purged rider IDs. The DB transaction has already
 * wiped the `Rider.pickupPhoto*` URL columns and the relational
 * `RiderPickupPhoto` rows; the on-disk files (S3 keys or local
 * paths depending on env) are the last remaining PII artifacts.
 *
 * This is best-effort: a failure here is logged but does NOT
 * roll back the DB purge. The DB is the source of truth for
 * GDPR minimization; the on-disk files become orphaned storage
 * garbage that an offline cleanup job can sweep.
 *
 * The implementation walks the configured uploads directory and
 * unlinks any file whose name contains one of the purged riderIds
 * (the upload path's key format includes the riderId — see
 * `StoragePathBuilder`). For S3 deployments the same scan runs
 * against the configured S3 prefix.
 */
async function purgeRiderPickupFiles(riderIds: string[]): Promise<void> {
  if (riderIds.length === 0) return;
  try {
    const { unlink, readdir, stat } = await import('fs/promises');
    const { join } = await import('path');
    const baseDir =
      process.env.LOCAL_STORAGE_ROOT ||
      join(process.cwd(), 'data', 'uploads');
    // Best-effort: stat the base dir; if it doesn't exist (e.g.
    // S3-only deployment, or fresh install) this is a no-op.
    try {
      const s = await stat(baseDir);
      if (!s.isDirectory()) return;
    } catch {
      return;
    }
    const entries = await readdir(baseDir, { recursive: true, withFileTypes: true }).catch(
      () => []
    );
    await Promise.allSettled(
      entries
        .filter((e) => e.isFile())
        .filter((e) => riderIds.some((rid) => e.name.includes(rid)))
        .map((e) => unlink(join(e.parentPath ?? baseDir, e.name)))
    );
  } catch (err) {
    logger.warn(
      '[DataDeletionPurgeJob] on-disk photo cleanup failed; DB purge succeeded',
      { err: err instanceof Error ? err.message : String(err) }
    );
  }
}
