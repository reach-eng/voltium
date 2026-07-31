/**
 * ━ Ticket #2 hardening ━
 * PostgreSQL-backed Job Queue using OutboxEvent and OutboxEventTypes.
 * Removed JobQueue.enqueue because it had zero callers; use OutboxService.emit.
 *
 * Features:
 * - Exponential backoff: delay = 2^attempts × 5s before retry
 * - Uses maxAttempts column (not hardcoded)
 * - Reaper: reclaims stuck PROCESSING rows after 5 minutes
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { OutboxEventTypes } from '@/server/workers/outbox';

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
  async processJobs(
    type: string,
    processor: (job: QueueJob) => Promise<void>,
    concurrency = 5
  ): Promise<void> {
    const now = clock.now();

    // Claim eligible pending jobs using the readyAt column (Phase 3.4).
    // A job is eligible when status='PENDING' and readyAt is either
    // NULL (first attempt) or <= now. The composite index on
    // (status, eventType, readyAt) keeps this fast at scale.
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
      SET status = 'PENDING',
          error = 'Reclaimed by reaper — stuck in PROCESSING'
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


