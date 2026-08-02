/**
 * Outbox Pattern — Reliable event processing for Voltium.
 *
 * Instead of firing background jobs directly from route handlers (which can
 * fail silently), important events are written to an `OutboxEvent` table
 * first. Workers then read and process pending events, marking them as
 * processed on success.
 *
 * This is the **canonical event type enum** — both producers and consumers
 * should reference these values. `queues.ts` re-exports this enum as `JOB_TYPES`.
 *
 * This guarantees at-least-once delivery: if the worker crashes mid-process,
 * the event remains pending and will be retried on the next poll cycle.
 */

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';

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
  // ── Wallet / Transactions ──────────────────────────────────────────────
  WALLET_TOPUP_REQUESTED: 'wallet.topup_requested',
  WALLET_TOPUP_APPROVED: 'wallet.topup_approved',
  WALLET_TOPUP_REJECTED: 'wallet.topup_rejected',
  WALLET_RECONCILIATION: 'wallet.reconciliation',
  DEPOSIT_APPROVED: 'deposit.approved',
  DEPOSIT_REJECTED: 'deposit.rejected',
  DEPOSIT_REFUNDED: 'deposit.refunded',

  // ── Notifications ──────────────────────────────────────────────────────
  NOTIFICATION_SEND: 'notification.send',
  SMS_SEND: 'sms.send',
  ANNOUNCEMENT_DISPATCH: 'notification.announcement',
  DAILY_ENGAGEMENT: 'engagement.daily',

  // ── Referrals ──────────────────────────────────────────────────────────
  REFERRAL_SIGNUP: 'referral.signup',
  REFERRAL_REWARD: 'referral.reward',

  // ── Rent / Leases ──────────────────────────────────────────────────────
  RENT_DUE: 'rent.due',
  RENT_OVERDUE: 'rent.overdue',
  RENT_PAID: 'rent.paid',
  RENT_DUE_CHECK: 'rent.due_check',

  // ── Device Compliance ──────────────────────────────────────────────────
  DEVICE_VIOLATION: 'device.violation',
  DEVICE_VIOLATION_SCAN: 'device.violation_scan',

  // ── Admin / System ─────────────────────────────────────────────────────
  ADMIN_ACTION: 'admin.action',

  // ── Cleanup (cron-driven, no producer) ─────────────────────────────────
  AUDIT_LOG_CLEANUP: 'cleanup.audit_log',
  TELEMETRY_DATA_CLEANUP: 'cleanup.telemetry',
} as const;

export type OutboxEventType = (typeof OutboxEventTypes)[keyof typeof OutboxEventTypes];

export const OutboxService = {
  /**
   * Write an event to the outbox table. The worker will pick it up later.
   *
   * Pass a Prisma transaction client (`tx`) when called inside a
   * prisma.$transaction() to get atomic business writes + outbox event.
   * Without the tx param, it writes directly to the database.
   */
  async emit(
    eventType: OutboxEventType,
    payload: Record<string, unknown>,
    maxAttempts = 3,
    tx?: Prisma.TransactionClient
  ): Promise<string> {
    const client = tx || db;
    try {
      const event = await client.outboxEvent.create({
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
  async cleanupCompleted(retentionDays = 1): Promise<number> {
    const cutoff = new Date(clock.now().getTime() - retentionDays * 24 * 60 * 60 * 1000);
    const result = await db.outboxEvent.deleteMany({
      where: {
        status: 'COMPLETED',
        processedAt: { lt: cutoff },
      },
    });
    return result.count;
  },
};
