/**
 * Orphaned pre-restore backup cleanup worker.
 *
 * PR-7 (2026-08-06 fix-plan, 6th audit P0): when a DR restore fails after the
 * pre-restore backup was created, restore.service.ts marks that backup row with
 * `errorMessage: 'ORPHANED_BY_FAILED_RESTORE:<restoreJobId>'` and emits an
 * audit entry. Without this worker the orphaned snapshot would sit on disk
 * forever (disk pressure, never rotated, silently lost if the box dies).
 *
 * This scheduled worker scans for PRE_RESTORE backups carrying the orphan
 * marker whose `createdAt` is older than 7 days (the operator-acknowledgement
 * window per the fix-plan) and purges them completely:
 *
 *   1. Delete the primary backup folder from disk.
 *   2. Delete the BackupJob database row.
 *   3. Write an audit entry (backup.orphan_purged) for the GDPR/DR log.
 *
 * Idempotency: keyed on IST date (mirrors data-deletion-purge). Runs once per
 * day; the 7-day cutoff is relative to `createdAt`, so rows are only touched
 * on the day they cross the threshold. Anything still pending stays until its
 * own day, and failures roll back the daily claim so the next run retries.
 */

import { db } from '@/lib/db';
import { type QueueJob } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { istDateKey } from '@/lib/date-keys';
import { checkOrClaimIdempotency, completeIdempotency, failIdempotency } from '@/lib/idempotency';
import { createAuditLog } from '@/lib/audit-log';
import { existsSync, rmSync } from 'fs';

const ORPHAN_MARKER_PREFIX = 'ORPHANED_BY_FAILED_RESTORE';
const CLEANUP_AFTER_DAYS = 7;

export const orphanBackupCleanupJob = {
  async process(job: Pick<QueueJob, 'id'>): Promise<{ purged: number }> {
    logger.info('[OrphanBackupCleanup] Starting', { jobId: job.id });

    const today = istDateKey(clock.now());
    const idempotencyKey = `orphan-backup-cleanup:daily:${today}`;
    const claim = await checkOrClaimIdempotency(idempotencyKey, 172800); // 48h TTL
    if (claim.status !== 'not_found') {
      logger.info('[OrphanBackupCleanup] Already processed today', { key: idempotencyKey });
      return { purged: 0 };
    }

    try {
      const cutoff = new Date(clock.now().getTime() - CLEANUP_AFTER_DAYS * 24 * 60 * 60 * 1000);

      const orphans = await db.backupJob.findMany({
        where: {
          type: 'PRE_RESTORE',
          errorMessage: { startsWith: ORPHAN_MARKER_PREFIX },
          createdAt: { lt: cutoff },
        },
        select: { id: true, backupPath: true, errorMessage: true },
      });

      if (orphans.length === 0) {
        logger.info('[OrphanBackupCleanup] No orphaned pre-restore backups to purge');
        await completeIdempotency(idempotencyKey, { purged: 0 }).catch(() => {});
        return { purged: 0 };
      }

      let purged = 0;
      for (const orphan of orphans) {
        const restoreJobId = orphan.errorMessage?.split(':')[1] ?? null;
        try {
          // 1. Delete the primary backup folder from disk.
          if (orphan.backupPath && existsSync(orphan.backupPath)) {
            rmSync(orphan.backupPath, { recursive: true, force: true });
          }

          // 2. Delete the BackupJob database row.
          await db.backupJob.delete({ where: { id: orphan.id } });

          // 3. Audit entry — the operator-facing record of the purge.
          await createAuditLog({
            actorId: 'system',
            actorType: 'SYSTEM',
            action: 'backup.orphan_purged',
            entity: 'BackupJob',
            entityId: orphan.id,
            details: {
              restoreJobId,
              marker: orphan.errorMessage,
              purgedAt: clock.now().toISOString(),
            },
          });

          purged += 1;
        } catch (err) {
          // A single bad row must not abort the whole sweep; log and continue.
          logger.error('[OrphanBackupCleanup] Failed to purge orphaned backup', {
            backupId: orphan.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      await completeIdempotency(idempotencyKey, { purged }).catch(() => {});
      logger.info('[OrphanBackupCleanup] Complete', { purged });
      return { purged };
    } catch (err) {
      await failIdempotency(idempotencyKey).catch(() => {});
      throw err;
    }
  },
};
