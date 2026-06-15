/**
 * PostgreSQL-backed Job Queue
 *
 * Uses the OutboxEvent table as a reliable job queue — no Redis dependency.
 * enqueue() writes an event; processJobs() polls pending events, processes
 * them, and marks COMPLETED or FAILED.
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
  async enqueue(type: string, payload: Record<string, unknown>, _delayMs = 0, maxAttempts = 3): Promise<string> {
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
    const pending = await db.outboxEvent.findMany({
      where: {
        eventType: type,
        status: 'PENDING',
        attempts: { lt: 3 },
        createdAt: { lte: new Date(Date.now() - 5_000) }, // 5s settle time
      },
      orderBy: { createdAt: 'asc' },
      take: concurrency,
    });

    if (pending.length === 0) return;

    for (const event of pending) {
      try {
        // Mark as PROCESSING
        await db.outboxEvent.update({
          where: { id: event.id },
          data: { status: 'PROCESSING' },
        });

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
        const eventData = event as any;

        await db.outboxEvent.update({
          where: { id: event.id },
          data: {
            attempts: { increment: 1 },
            error: errorMessage,
            status: (eventData.attempts ?? 0) + 1 >= (eventData.maxAttempts ?? 3) ? 'FAILED' : 'PENDING',
          },
        });

        logger.error('[JobQueue] Failed to process job', {
          jobId: event.id,
          type,
          error: errorMessage,
        });
      }
    }
  },

  async getQueueStats(type: string): Promise<{ pending: number; processing: number; failed: number }> {
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
