/**
 * PostgreSQL-backed Job Queue
 *
 * Uses the OutboxEvent table as a reliable job queue.
 * processJobs() polls pending events, processes them, and marks
 * COMPLETED or FAILED.
 *
 * ━ Ticket #2 hardening ━ removed JobQueue.enqueue (zero callers —
 * all background jobs go through OutboxService.emit in `outbox.ts`).
 * Removed the in-memory `notifyOnFailSet` that was only used by the
 * dead enqueue function. Removed the duplicate `JobTypes` constant —
 * callers should use `OutboxEventTypes` from `outbox.ts`.
 *
 * Features:
 * - Exponential backoff: delay = 2^attempts × 5s before retry
 * - Uses maxAttempts column (not hardcoded)
 * - Reaper: reclaims stuck PROCESSING rows with configurable threshold
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { alerter } from '@/lib/alerter';

/** Per-job-type reaper threshold configuration (in minutes). */
const REAPER_THRESHOLDS_MINUTES: Record<string, number> = {
  'wallet.reconciliation': 15, // long-running batch job
  'sms.send': 2,               // should be fast
  'notification.send': 2,      // should be fast
};
const DEFAULT_REAPER_THRESHOLD_MINUTES = 5;

export interface QueueJob {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  createdAt: number;
  processedAt?: number;
  error?: string;
}

export const JobQueue = {
  /**
   * Claim and process up to `concurrency` pending jobs of the given type.
   *
   * Uses `FOR UPDATE SKIP LOCKED` for safe concurrent claiming across
   * multiple worker processes. Failed jobs get exponential backoff.
   * When a job exceeds maxAttempts, it's marked FAILED and optionally
   * posted to the alerter.
   */
  async processJobs(
    type: string,
    processor: (job: QueueJob) => Promise<void>,
    concurrency = 5,
  ): Promise<void> {
    const now = clock.now();

    const pending = await db.$queryRaw<
      Array<{
        id: string;
        eventType: string;
        payload: string;
        status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
        attempts: number;
        maxAttempts: number;
        createdAt: Date;
        readyAt: Date | null;
      }>
    >`
      UPDATE "outbox_events"
      SET status = 'PROCESSING'
      WHERE id IN (
        SELECT id
        FROM "outbox_events"
        WHERE "eventType" = ${type}
          AND status = 'PENDING'
          AND attempts < "maxAttempts"
          AND ("readyAt" IS NULL OR "readyAt" <= ${now.toISOString()}::timestamp)
        ORDER BY "createdAt" ASC
        LIMIT ${concurrency}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, "eventType", payload, status, attempts, "maxAttempts", "createdAt", "readyAt"
    `;

    if (pending.length === 0) return;

    await Promise.allSettled(
      pending.map(async (event: { id: string; eventType: string; payload: string; status: string; attempts: number; maxAttempts: number; createdAt: Date; readyAt: Date | null }) => {
        try {
          const job: QueueJob = {
            id: event.id,
            type: event.eventType,
            payload: JSON.parse(event.payload),
            status: 'pending',
            attempts: event.attempts,
            createdAt: event.createdAt.getTime(),
          };

          await processor(job);

          await db.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: 'COMPLETED',
              processedAt: clock.now(),
              attempts: { increment: 1 },
              readyAt: null,
            },
          });
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : String(err);
          const newAttempts = event.attempts + 1;
          const isMaxed = newAttempts >= event.maxAttempts;

          const backoffMs = Math.min(
            Math.pow(2, newAttempts) * 5000,
            3600000,
          );
          const nextReadyAt = new Date(clock.now().getTime() + backoffMs);

          await db.outboxEvent.update({
            where: { id: event.id },
            data: {
              attempts: { increment: 1 },
              error: errorMessage,
              status: isMaxed ? 'FAILED' : 'PENDING',
              readyAt: isMaxed ? null : nextReadyAt,
            },
          });

          logger.error('[JobQueue] Failed to process job', {
            jobId: event.id,
            type,
            attempts: newAttempts,
            maxAttempts: event.maxAttempts,
            backoffMs,
            nextReadyAt: nextReadyAt.toISOString(),
            error: errorMessage,
          });

          // Ticket #2: removed the in-memory `notifyOnFail` set.
          // Per-job alerting (when critical) should be added by the
          // caller via a per-type notifier, not the legacy Set<string>
          // which was session-scoped and lost on worker restart.
          // For now, failed jobs are logged; the alerter pattern is
          // covered by the per-job `notifyOnFailure` flag in
          // `server/workers/job-wrapper.ts` (which writes to the
          // outbox row's notifyOnFailure field, not a Set).
        }
      }),
    );
  },

  /**
   * Reaper: Reclaims stuck PROCESSING events that haven't been updated
   * within the per-job-type threshold. Resets them to PENDING and
   * increments attempts so they don't get stuck in an infinite reclaim loop.
   *
   * Per-type threshold lookup is done per-row in raw SQL so long-running
   * jobs (e.g. wallet.reconciliation at 15 min) aren't reclaimed while
   * still in flight.
   */
  async runReaper(): Promise<number> {
    const now = clock.now();
    const defaultThresholdMs = DEFAULT_REAPER_THRESHOLD_MINUTES * 60 * 1000;
    // Threshold map keyed by eventType, in milliseconds. Used inside the
    // SQL CASE expression so the per-row comparison happens in the DB.
    const thresholdByType: Record<string, number> = {};
    for (const [type, minutes] of Object.entries(REAPER_THRESHOLDS_MINUTES)) {
      thresholdByType[type] = minutes * 60 * 1000;
    }

    // Build the CASE expression for per-type threshold (in SQL):
    //   CASE
    //     WHEN "eventType" = 'wallet.reconciliation' THEN interval '15 minutes'
    //     WHEN "eventType" = 'sms.send' THEN interval '2 minutes'
    //     ELSE interval '5 minutes'
    //   END
    // then reclaim only if updatedAt is older than that per-type cutoff.
    const caseLines = Object.entries(thresholdByType)
      .map(([type, ms]) => {
        const minutes = Math.round(ms / 60000);
        // Escape single quotes in type for SQL safety (eventType is server-controlled)
        const safeType = type.replace(/'/g, "''");
        return `WHEN "eventType" = '${safeType}' THEN interval '${minutes} minutes'`;
      })
      .join('\n          ');
    const defaultMinutes = Math.round(defaultThresholdMs / 60000);
    const caseExpr = `CASE\n          ${caseLines}\n          ELSE interval '${defaultMinutes} minutes'\n        END`;

    // Conditional UPDATE: only reclaim rows where status is still PROCESSING
    // AND the row has been processing longer than the per-type threshold.
    // We use a CTE + UPDATE so the per-type comparison happens in one round-trip.
    const result = await db.$executeRaw`
      WITH stuck AS (
        SELECT id
        FROM "outbox_events"
        WHERE status = 'PROCESSING'
          AND "updatedAt" < (${now.toISOString()}::timestamp - ${caseExpr}::interval)
      )
      UPDATE "outbox_events"
      SET status = 'PENDING',
          "readyAt" = NULL,
          attempts = "outbox_events".attempts + 1,
          error = 'Reclaimed by reaper — stuck in PROCESSING'
      FROM stuck
      WHERE "outbox_events".id = stuck.id
        AND "outbox_events".status = 'PROCESSING'
    `;

    const count = Number(result);

    if (count > 0) {
      logger.warn('[JobQueue] Reaper reclaimed stuck PROCESSING events', {
        count,
      });

      // Alert on reclaimed jobs so ops can investigate
      await alerter.send({
        level: 'warn',
        title: 'Reaper reclaimed stuck jobs',
        source: 'job-queue:reaper',
        message: `Reaper reclaimed ${count} stuck job(s)`,
        details: { count },
      });
    }

    return count;
  },

  /** Get stuck-PROCESSING count for health monitoring. */
  async getStuckProcessingCount(): Promise<number> {
    const cutoff = new Date(clock.now().getTime() - 5 * 60 * 1000);
    return db.outboxEvent.count({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: cutoff },
      },
    });
  },

  async getQueueStats(
    type: string,
  ): Promise<{ pending: number; processing: number; failed: number }> {
    const [pending, processing, failed] = await Promise.all([
      db.outboxEvent.count({ where: { eventType: type, status: 'PENDING' } }),
      db.outboxEvent.count({
        where: { eventType: type, status: 'PROCESSING' },
      }),
      db.outboxEvent.count({ where: { eventType: type, status: 'FAILED' } }),
    ]);
    return { pending, processing, failed };
  },

  async retryFailedJobs(type: string): Promise<number> {
    const result = await db.outboxEvent.updateMany({
      where: { eventType: type, status: 'FAILED' },
      data: { status: 'PENDING', attempts: 0, error: null },
    });
    return result.count;
  },

  async clearQueue(type: string): Promise<void> {
    await db.outboxEvent.deleteMany({
      where: { eventType: type, status: { in: ['PENDING', 'PROCESSING'] } },
    });
  },
};

// ━ Ticket #2: removed the in-memory `notifyOnFailSet` (was only used by
// the deleted enqueue function). Removed the duplicate `JobTypes` enum
// (use `OutboxEventTypes` from `outbox.ts` instead).
