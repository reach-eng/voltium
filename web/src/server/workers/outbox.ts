/**
 * Outbox Pattern — Reliable event processing for Voltium.
 *
 * Instead of firing background jobs directly from route handlers (which can
 * fail silently), important events are written to an `OutboxEvent` table
 * first. Workers then read and process pending events, marking them as
 * processed on success.
 *
 * This guarantees at-least-once delivery: if the worker crashes mid-process,
 * the event remains pending and will be retried on the next poll cycle.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { JobQueue } from '@/lib/job-queue';
import { getQueueForJob } from './queues';

export type OutboxEventStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface OutboxEventData {
  id: string;
  eventType: string;
  payload: Record<string, unknown>;
  status: OutboxEventStatus;
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
}

export const OutboxEventTypes = {
  // Wallet events
  WALLET_TOPUP_REQUESTED: 'wallet.topup_requested',
  WALLET_TOPUP_APPROVED: 'wallet.topup_approved',
  WALLET_TOPUP_REJECTED: 'wallet.topup_rejected',
  DEPOSIT_APPROVED: 'deposit.approved',
  DEPOSIT_REJECTED: 'deposit.rejected',
  DEPOSIT_REFUNDED: 'deposit.refunded',

  // Notifications
  NOTIFICATION_SEND: 'notification.send',
  SMS_SEND: 'sms.send',

  // Referrals
  REFERRAL_SIGNUP: 'referral.signup',
  REFERRAL_REWARD: 'referral.reward',

  // Rent
  RENT_DUE: 'rent.due',
  RENT_OVERDUE: 'rent.overdue',
  RENT_PAID: 'rent.paid',

  // Compliance
  DEVICE_VIOLATION: 'device.violation',

  // Admin
  ADMIN_ACTION: 'admin.action',
} as const;

export type OutboxEventType = (typeof OutboxEventTypes)[keyof typeof OutboxEventTypes];

export const OutboxService = {
  /**
   * Write an event to the outbox table. The worker will pick it up later.
   */
  async emit(
    eventType: OutboxEventType,
    payload: Record<string, unknown>,
    maxAttempts = 3
  ): Promise<string> {
    try {
      const event = await db.outboxEvent.create({
        data: {
          eventType,
          payload: JSON.stringify(payload),
          status: 'PENDING',
          maxAttempts,
        },
        select: { id: true },
      });

      logger.debug('[Outbox] Event emitted', { eventType, eventId: event.id });
      return event.id;
    } catch (err) {
      logger.error('[Outbox] Failed to emit event', { eventType, err });
      throw err;
    }
  },

  /**
   * Process pending outbox events.
   * Reads events up to `batchSize`, processes each in sequence, and marks
   * them COMPLETED or FAILED.
   */
  async processPendingEvents(batchSize = 50): Promise<number> {
    const pending = (await db.outboxEvent.findMany({
      where: {
        status: 'PENDING',
        attempts: { lt: 3 }, // max 3 attempts per event's maxAttempts field
        // Only retry events that were created more than 30 seconds ago
        // (to give the queue time to settle)
        createdAt: { lte: new Date(Date.now() - 30_000) },
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    })) as unknown as OutboxEventData[];

    if (pending.length === 0) return 0;

    let processed = 0;

    for (const event of pending) {
      try {
        // Mark as PROCESSING
        await db.outboxEvent.update({
          where: { id: event.id },
          data: { status: 'PROCESSING' },
        });

        // Enqueue the job in the appropriate queue
        const jobType = this.mapEventTypeToJobType(event.eventType);
        const queueName = getQueueForJob(jobType);

        await JobQueue.enqueue(jobType, event.payload);

        // Mark as COMPLETED
        await db.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date(),
            attempts: { increment: 1 },
          },
        });

        processed++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';

        // Update attempt count
        await db.outboxEvent.update({
          where: { id: event.id },
          data: {
            attempts: { increment: 1 },
            error: errorMessage,
            status: event.attempts + 1 >= (event.maxAttempts || 3) ? 'FAILED' : 'PENDING',
          },
        });

        logger.error('[Outbox] Failed to process event', {
          eventId: event.id,
          eventType: event.eventType,
          error: errorMessage,
          attempt: event.attempts + 1,
        });
      }
    }

    return processed;
  },

  /**
   * Map an OutboxEventType to a JobType for queue routing.
   */
  mapEventTypeToJobType(eventType: string): string {
    const mapping: Record<string, string> = {
      [OutboxEventTypes.WALLET_TOPUP_REQUESTED]: 'wallet_reconciliation',
      [OutboxEventTypes.WALLET_TOPUP_APPROVED]: 'wallet_reconciliation',
      [OutboxEventTypes.WALLET_TOPUP_REJECTED]: 'wallet_reconciliation',
      [OutboxEventTypes.DEPOSIT_APPROVED]: 'wallet_reconciliation',
      [OutboxEventTypes.DEPOSIT_REJECTED]: 'wallet_reconciliation',
      [OutboxEventTypes.DEPOSIT_REFUNDED]: 'wallet_reconciliation',
      [OutboxEventTypes.NOTIFICATION_SEND]: 'announcement_dispatch',
      [OutboxEventTypes.SMS_SEND]: 'send_sms',
      [OutboxEventTypes.REFERRAL_SIGNUP]: 'referral_reward_process',
      [OutboxEventTypes.REFERRAL_REWARD]: 'referral_reward_process',
      [OutboxEventTypes.RENT_DUE]: 'rent_due_check',
      [OutboxEventTypes.RENT_OVERDUE]: 'overdue_escalation',
      [OutboxEventTypes.RENT_PAID]: 'rent_due_check',
      [OutboxEventTypes.DEVICE_VIOLATION]: 'device_violation_scan',
    };
    return mapping[eventType] || 'notification';
  },

  /**
   * Get outbox stats — counts of PENDING, PROCESSING, COMPLETED, FAILED events.
   */
  async getStats(): Promise<Record<string, number>> {
    const [pending, processing, completed, failed] = await Promise.all([
      db.outboxEvent.count({ where: { status: 'PENDING' } }),
      db.outboxEvent.count({ where: { status: 'PROCESSING' } }),
      db.outboxEvent.count({ where: { status: 'COMPLETED' } }),
      db.outboxEvent.count({ where: { status: 'FAILED' } }),
    ]);

    return { pending, processing, completed, failed };
  },

  /**
   * Retry all FAILED outbox events (reset to PENDING with attempts=0).
   */
  async retryFailed(): Promise<number> {
    const result = await db.outboxEvent.updateMany({
      where: { status: 'FAILED' },
      data: {
        status: 'PENDING',
        attempts: 0,
        error: null,
      },
    });
    return result.count;
  },

  /**
   * Cleanup COMPLETED events older than the retention period.
   */
  async cleanupCompleted(retentionDays = 7): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await db.outboxEvent.deleteMany({
      where: {
        status: 'COMPLETED',
        processedAt: { lt: cutoff },
      },
    });
    return result.count;
  },
};
