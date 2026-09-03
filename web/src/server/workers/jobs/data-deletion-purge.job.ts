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
const RIDER_PII_FIELDS = {
  email: null,
  fatherName: null,
  motherName: null,
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
        // P1: bound (naturally tiny — CLOSED + 7-day appeal passed — but
        // never unbounded).
        orderBy: { deletedAt: 'asc' },
        take: 500,
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
          // P1: device + sync + notification + file rows are PII too and had
          // no retention TTL (indefinite history). Destroy them with the
          // purge. NOTE: FileRecord *blobs on disk* (storageKey) are NOT
          // removed here — a storage-GC sweep keyed off missing FileRecords
          // is tracked as follow-up; the DB rows (owner/purpose/metadata)
          // are gone so nothing references them.
          // Defensive typeof-guards: unit-test tx doubles may not implement
          // every delegate (prod Prisma always does).
          const purgeModels = [
            'userContact',
            'userCallLog',
            'userLocation',
            'syncQueue',
            'notificationDelivery',
            'notification',
          ] as const;
          for (const model of purgeModels) {
            const delegate = (tx as Record<string, { deleteMany?: (args: unknown) => Promise<unknown> }>)[model];
            if (delegate && typeof delegate.deleteMany === 'function') {
              await delegate.deleteMany({ where: { riderId: rider.id } });
            }
          }
          let fileKeysToDelete: string[] = [];
          const fileDelegate = (
            tx as unknown as Record<
              string,
              {
                findMany?: (args: unknown) => Promise<Array<{ storageKey: string }>>;
                deleteMany?: (args: unknown) => Promise<unknown>;
              }
            >
          ).fileRecord;
          if (fileDelegate && typeof fileDelegate.findMany === 'function') {
            try {
              const files = await fileDelegate.findMany({
                where: { ownerType: 'RIDER', ownerId: rider.id },
                select: { storageKey: true },
              });
              if (Array.isArray(files)) {
                fileKeysToDelete = files.map((f) => f.storageKey).filter(Boolean);
              }
            } catch (err) {
              logger.warn('[DataDeletionPurge] Could not query fileRecords for blob deletion', { err });
            }
          }
          if (fileDelegate && typeof fileDelegate.deleteMany === 'function') {
            await fileDelegate.deleteMany({
              where: { ownerType: 'RIDER', ownerId: rider.id },
            });
          }

          // Delete physical file blobs on disk for purged rider files
          if (fileKeysToDelete.length > 0) {
            try {
              const { getStorageProvider } = await import('@/lib/storage');
              const storageProvider = await getStorageProvider();
              for (const key of fileKeysToDelete) {
                await storageProvider.delete(key).catch((err: Error) =>
                  logger.warn('[DataDeletionPurge] Failed to delete blob from storage', { key, err })
                );
              }
            } catch (err) {
              logger.warn('[DataDeletionPurge] Storage provider error deleting blobs', { err });
            }
          }
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
                ],
              }),
            },
          });
          count += 1;
        }
        return count;
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
