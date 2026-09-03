/**
 * ━ Ticket #2 hardening ━
 * PostgreSQL-backed Job Queue using OutboxEvent and OutboxEventTypes.
 * Removed JobQueue.enqueue because it had zero callers; use OutboxService.emit.
 *
 * Features:
 * - Exponential backoff: delay = 2^attempts × 5s before retry
 * - Uses maxAttempts column (not hardcoded)
 * - Reaper: reclaims stuck PROCESSING rows after 5 minutes
 * - PR-75: optional `priority` filter for interactive vs background
 *   job splits. When `priority` is provided, the claim query only
 *   picks events with that priority. The orchestrator passes
 *   'interactive' to drain latency-sensitive events first; the
 *   default (no priority arg) keeps the pre-PR-75 FIFO behavior.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { OutboxEventTypes } from '@/server/workers/outbox';
import { Prisma } from '@prisma/client';

export interface QueueJob {
  id: string;
  type?: string;
  payload?: Record<string, unknown>;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  attempts?: number;
  createdAt?: number;
  processedAt?: number;
  error?: string;
}

export const JobQueue = {
  /**
   * Claim and process up to `concurrency` pending events of `type`.
   *
   * PR-75: `priority` is an optional filter. When undefined, the
   * claim query is the pre-PR-75 FIFO query (preserves backward
   * compatibility for any caller that doesn't care about priority).
   * When 'interactive' or 'background', the claim is restricted to
   * events of that priority only.
   */
  async processJobs(
    type: string,
    processor: (job: QueueJob) => Promise<void>,
    concurrency = 5,
    priority?: 'interactive' | 'background'
  ): Promise<number> {
    const now = clock.now();

    // Claim eligible pending jobs using the readyAt column (Phase 3.4).
    // A job is eligible when status='PENDING' and readyAt is either
    // NULL (first attempt) or <= now. The composite index on
    // (status, eventType, readyAt) keeps this fast at scale.
    //
    // PR-75: the `priority` filter is applied via a parameterised
    // fragment. When `priority` is undefined, the fragment is empty
    // so the query plan matches the pre-PR-75 path. The migration
    // added a composite (priority, status, createdAt) index for the
    // filtered case.
    const priorityFragment = priority
      ? Prisma.sql`AND "priority" = ${priority}`
      : Prisma.sql``;

    type ClaimedRow = {
      id: string;
      eventType: string;
      payload: string;
      status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
      attempts: number;
      maxAttempts: number;
      createdAt: Date;
      readyAt: Date | null;
    };

    // PR-75: priority fragment is interpolated via Prisma.sql. The
    // generic on $queryRaw can't be inferred through the embedded
    // Prisma.Sql value, so we cast through unknown. The shape of the
    // RETURNING clause is unchanged from the pre-PR-75 query.
    const pending = (await db.$queryRaw(
      Prisma.sql`
        UPDATE "outbox_events"
        SET status = 'PROCESSING'
        WHERE id IN (
          SELECT id
          FROM "outbox_events"
          WHERE "eventType" = ${type}
            AND status = 'PENDING'
            AND attempts < "maxAttempts"
            AND ("readyAt" IS NULL OR "readyAt" <= ${now.toISOString()}::timestamp)
            ${priorityFragment}
          ORDER BY "createdAt" ASC
          LIMIT ${concurrency}
          FOR UPDATE SKIP LOCKED
        )
        RETURNING id, "eventType", payload, status, attempts, "maxAttempts", "createdAt", "readyAt"
      `
    )) as ClaimedRow[];

    if (pending.length === 0) return 0;

    for (const event of pending) {
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

        // Mark as COMPLETED
        await db.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'COMPLETED',
            processedAt: clock.now(),
            attempts: { increment: 1 },
            readyAt: null, // Reset backoff for any future re-runs
          },
        });

        try {
          const { outboxProcessedTotal } = await import('@/lib/prometheus');
          outboxProcessedTotal.inc({ status: 'success', event_type: type });
        } catch {}
      } catch (err) {
        const errorMessage = err instanceof Error ? (err instanceof Error ? err.message : String(err)) : 'Unknown error';
        const newAttempts = event.attempts + 1;
        const isMaxed = newAttempts >= event.maxAttempts;

        // Phase 3.4: write the exponential-backoff readyAt. The previous
        // version only bumped `attempts`; the next claim cycle would
        // immediately retry because the SELECT did not consider
        // attempts-vs-time. The new readyAt uses createdAt + 2^attempts × 5s
        // (capped at 1 hour) so the claim cycle honours the backoff.
        const backoffMs = Math.min(Math.pow(2, newAttempts) * 5000, 3600000);
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

        try {
          const { outboxProcessedTotal } = await import('@/lib/prometheus');
          outboxProcessedTotal.inc({ status: isMaxed ? 'failed' : 'retry', event_type: type });
        } catch {}

        logger.error('[JobQueue] Failed to process job', {
          jobId: event.id,
          type,
          attempts: newAttempts,
          maxAttempts: event.maxAttempts,
          backoffMs,
          nextReadyAt: nextReadyAt.toISOString(),
          error: errorMessage,
        });
      }
    }
    return pending.length;
  },

  /**
   * Reaper: Reclaims stuck PROCESSING events that haven't been updated
   * in more than 5 minutes. Resets them to PENDING so they get retried.
   * Run this periodically (e.g. every 5 minutes).
   */
  async runReaper(): Promise<number> {
    const now = clock.now();
    const result = await db.$executeRaw`
      UPDATE "outbox_events"
      SET status = CASE
            WHEN attempts + 1 >= "maxAttempts" THEN 'FAILED'
            ELSE 'PENDING'
          END,
          attempts = attempts + 1,
          error = CASE
            WHEN attempts + 1 >= "maxAttempts" THEN 'Reclaimed by reaper — exceeded maximum retry attempts'
            ELSE 'Reclaimed by reaper — stuck in PROCESSING'
          END,
          "processedAt" = CASE
            WHEN attempts + 1 >= "maxAttempts" THEN ${now}
            ELSE "processedAt"
          END,
          "updatedAt" = ${now}
      WHERE status = 'PROCESSING'
        AND (
          ("eventType" = 'sms.send' AND "updatedAt" <= ${new Date(now.getTime() - 2 * 60 * 1000)})
          OR ("eventType" = 'wallet.reconciliation' AND "updatedAt" <= ${new Date(now.getTime() - 15 * 60 * 1000)})
          OR ("eventType" NOT IN ('sms.send', 'wallet.reconciliation') AND "updatedAt" <= ${new Date(now.getTime() - 5 * 60 * 1000)})
        )
    `;
    if (result > 0) {
      logger.warn('[JobQueue] Reaper reclaimed stuck PROCESSING events', { count: result });
    }
    return result;
  },

  /**
   * Get stuck-PROCESSING count for health monitoring.
   */
  async getStuckProcessingCount(): Promise<number> {
    const cutoff = new Date(clock.now().getTime() - 5 * 60 * 1000);
    const result = await db.outboxEvent.count({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: cutoff },
      },
    });
    return result;
  },

  async getQueueStats(
    type: string
  ): Promise<{ pending: number; processing: number; failed: number }> {
    const [pending, processing, failed] = await Promise.all([
      db.outboxEvent.count({ where: { eventType: type, status: 'PENDING' } }),
      db.outboxEvent.count({ where: { eventType: type, status: 'PROCESSING' } }),
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

  async purgeCompletedEvents(olderThanDays = 30): Promise<number> {
    const cutoff = new Date(clock.now().getTime() - olderThanDays * 24 * 60 * 60 * 1000);
    const result = await db.outboxEvent.deleteMany({
      where: {
        status: { in: ['COMPLETED', 'FAILED'] },
        updatedAt: { lt: cutoff },
      },
    });
    logger.info('[JobQueue] Purged old outbox events', { deletedCount: result.count, olderThanDays });
    return result.count;
  },
};


