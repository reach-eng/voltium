/**
 * PostgreSQL-backed Job Queue
 *
 * Uses the OutboxEvent table as a reliable job queue — no PostgreSQL-backed local store dependency.
 * enqueue() writes an event; processJobs() polls pending events, processes
 * them, and marks COMPLETED or FAILED.
 *
 * Features:
 * - Exponential backoff: delay = 2^attempts × 5s before retry
 * - Uses maxAttempts column (not hardcoded)
 * - Reaper: reclaims stuck PROCESSING rows after 5 minutes
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

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
  async enqueue(
    type: string,
    payload: Record<string, unknown>,
    _delayMs = 0,
    maxAttempts = 3
  ): Promise<string> {
    try {
      const event = await db.outboxEvent.create({
        data: {
          eventType: type,
          payload: JSON.stringify(payload),
          status: 'PENDING',
          maxAttempts,
        },
        select: { id: true },
      });

      logger.debug('[JobQueue] Job enqueued', { type, jobId: event.id });
      return event.id;
    } catch (err) {
      logger.error('[JobQueue] Failed to enqueue job', { type, err });
      throw err;
    }
  },

  async processJobs(
    type: string,
    processor: (job: QueueJob) => Promise<void>,
    concurrency = 5
  ): Promise<void> {
    const now = new Date();

    // Claim eligible pending jobs using maxAttempts column.
    // A job is "ready" if createdAt + 2^attempts × 5s <= now.
    // For attempt 0: 5s delay; attempt 1: 10s; attempt 2: 20s; etc.
    // Cap backoff at 1 hour.
    const pending = await db.$queryRaw<
      Array<{
        id: string;
        eventType: string;
        payload: string;
        status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
        attempts: number;
        maxAttempts: number;
        createdAt: Date;
      }>
    >`
      UPDATE "OutboxEvent"
      SET status = 'PROCESSING'
      WHERE id IN (
        SELECT id
        FROM "OutboxEvent"
        WHERE "eventType" = ${type}
          AND status = 'PENDING'
          AND attempts < "maxAttempts"
          AND "createdAt" <= ${now}::timestamptz - LEAST(
            INTERVAL '5 seconds' * POWER(2, GREATEST(attempts, 0)),
            INTERVAL '1 hour'
          )
        ORDER BY "createdAt" ASC
        LIMIT ${concurrency}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id, "eventType", payload, status, attempts, "maxAttempts", "createdAt"
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
            processedAt: new Date(),
            attempts: { increment: 1 },
          },
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        const newAttempts = event.attempts + 1;
        const isMaxed = newAttempts >= event.maxAttempts;

        // On failure: increment attempts, set backoff-based retry time
        // Since no readyAt column exists, we rely on createdAt + backoff
        await db.outboxEvent.update({
          where: { id: event.id },
          data: {
            attempts: { increment: 1 },
            error: errorMessage,
            status: isMaxed ? 'FAILED' : 'PENDING',
          },
        });

        logger.error('[JobQueue] Failed to process job', {
          jobId: event.id,
          type,
          attempts: newAttempts,
          maxAttempts: event.maxAttempts,
          backoffMs: Math.min(Math.pow(2, newAttempts) * 5000, 3600000),
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
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
    const result = await db.outboxEvent.updateMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: cutoff },
      },
      data: {
        status: 'PENDING',
        error: 'Reclaimed by reaper — stuck in PROCESSING',
      },
    });
    if (result.count > 0) {
      logger.warn('[JobQueue] Reaper reclaimed stuck PROCESSING events', {
        count: result.count,
      });
    }
    return result.count;
  },

  /**
   * Get stuck-PROCESSING count for health monitoring.
   */
  async getStuckProcessingCount(): Promise<number> {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000);
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
};

export const JobTypes = {
  SEND_SMS: 'sms.send',
  SEND_EMAIL: 'send_email',
  NOTIFICATION: 'notification.send',
  RIDE_REMINDER: 'ride_reminder',
  REFERRAL_REWARD: 'referral.reward',
  REFUND_PROCESSING: 'refund_processing',
};
