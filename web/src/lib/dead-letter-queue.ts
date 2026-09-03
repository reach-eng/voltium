/**
 * Dead-Letter Queue (DLQ) Service
 *
 * Provides lifecycle management, querying, manual replay/retry,
 * and alerting for jobs that have exhausted their retry budget.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { alerter } from '@/lib/alerter';

export interface DeadLetterJobQueryOptions {
  eventType?: string;
  limit?: number;
  offset?: number;
}

export const DeadLetterQueue = {
  /**
   * Record and alert on a permanently dead-lettered job.
   */
  async handleDeadLetter(job: {
    id: string;
    eventType: string;
    attempts: number;
    maxAttempts: number;
    error: string;
    payload?: string;
  }): Promise<void> {
    logger.error('[DLQ] Job dead-lettered after exhausting retries', {
      jobId: job.id,
      eventType: job.eventType,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      error: job.error,
    });

    try {
      await alerter.send({
        level: 'critical',
        title: `🚨 Job Dead-Lettered: ${job.eventType}`,
        message: `Outbox event ${job.id} failed after ${job.attempts}/${job.maxAttempts} attempts. Last error: ${job.error.slice(0, 200)}`,
        source: 'lib/dead-letter-queue',
        details: {
          jobId: job.id,
          eventType: job.eventType,
          attempts: job.attempts,
          error: job.error,
        },
      });
    } catch (alertErr) {
      logger.error('[DLQ] Failed to send dead-letter alert', alertErr);
    }
  },

  /**
   * List all dead-lettered jobs with pagination.
   */
  async listDeadLetterJobs(options: DeadLetterJobQueryOptions = {}) {
    const { eventType, limit = 50, offset = 0 } = options;
    const where = {
      status: 'FAILED' as const,
      ...(eventType ? { eventType } : {}),
    };

    const [jobs, total] = await Promise.all([
      db.outboxEvent.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.outboxEvent.count({ where }),
    ]);

    return { jobs, total, limit, offset };
  },

  /**
   * Replay / re-arm a dead-lettered job for execution.
   */
  async retryJob(id: string): Promise<boolean> {
    const event = await db.outboxEvent.findUnique({ where: { id } });
    if (!event || event.status !== 'FAILED') {
      return false;
    }

    await db.outboxEvent.update({
      where: { id },
      data: {
        status: 'PENDING',
        attempts: 0,
        readyAt: null,
        error: null,
      },
    });

    logger.info('[DLQ] Dead-lettered job re-armed for retry', { jobId: id, eventType: event.eventType });
    return true;
  },

  /**
   * Purge a dead-lettered job permanently.
   */
  async purgeJob(id: string): Promise<boolean> {
    try {
      await db.outboxEvent.delete({ where: { id } });
      return true;
    } catch {
      return false;
    }
  },
};
