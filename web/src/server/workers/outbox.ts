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
   * Note: Job processing is now handled by workers/index.ts via
   * JobQueue.processJobs() which reads directly from the OutboxEvent table.
   * This method is intentionally omitted — use the worker loop instead.
   */

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
