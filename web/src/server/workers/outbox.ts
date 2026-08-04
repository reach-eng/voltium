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
  /**
   * @deprecated Unused — never emitted, never consumed. Scheduled
   * for removal in v0.4.
   */
  WALLET_TOPUP_REQUESTED: 'wallet.topup_requested',
  WALLET_TOPUP_APPROVED: 'wallet.topup_approved',
  WALLET_TOPUP_REJECTED: 'wallet.topup_rejected',
  WALLET_RECONCILIATION: 'wallet.reconciliation',
  /**
   * @deprecated Unused — never emitted, never consumed. Scheduled
   * for removal in v0.4.
   */
  DEPOSIT_APPROVED: 'deposit.approved',
  /**
   * @deprecated Unused — never emitted, never consumed. Scheduled
   * for removal in v0.4.
   */
  DEPOSIT_REJECTED: 'deposit.rejected',
  /**
   * @deprecated Unused — never emitted, never consumed. Scheduled
   * for removal in v0.4.
   */
  DEPOSIT_REFUNDED: 'deposit.refunded',

  // ── Notifications ──────────────────────────────────────────────────────
  NOTIFICATION_SEND: 'notification.send',
  SMS_SEND: 'sms.send',
  /**
   * @deprecated Unused — never emitted, never consumed. Scheduled
   * for removal in v0.4.
   */
  ANNOUNCEMENT_DISPATCH: 'notification.announcement',
  DAILY_ENGAGEMENT: 'engagement.daily',

  // ── Referrals ──────────────────────────────────────────────────────────
  /**
   * @deprecated Unused — never emitted, never consumed. Scheduled
   * for removal in v0.4.
   */
  REFERRAL_SIGNUP: 'referral.signup',
  REFERRAL_REWARD: 'referral.reward',

  // ── Rent / Leases ──────────────────────────────────────────────────────
  /**
   * @deprecated Unused — never emitted, never consumed. Scheduled
   * for removal in v0.4.
   */
  RENT_DUE: 'rent.due',
  RENT_OVERDUE: 'rent.overdue',
  /**
   * @deprecated Unused — never emitted, never consumed. Scheduled
   * for removal in v0.4.
   */
  RENT_PAID: 'rent.paid',
  RENT_DUE_CHECK: 'rent.due_check',

  // ── Device Compliance ──────────────────────────────────────────────────
  DEVICE_VIOLATION: 'device.violation',
  DEVICE_VIOLATION_SCAN: 'device.violation_scan',

  // ── Admin / System ─────────────────────────────────────────────────────
  ADMIN_ACTION: 'admin.action',

  // PR-89 (API N3): admin-triggered job enqueue events. These types
  // exist so that `admin/jobs` POST can publish a job request to the
  // outbox instead of running the job synchronously. The dispatcher
  // handles them by routing to the same internal handler that the
  // cron tick uses.
  ADMIN_JOB_WALLET_RECONCILIATION: 'admin.job.wallet_reconciliation',
  ADMIN_JOB_RENT_DUE_CHECK: 'admin.job.rent_due_check',
  ADMIN_JOB_DEVICE_COMPLIANCE: 'admin.job.device_compliance',
  ADMIN_JOB_REFERRAL_REWARD: 'admin.job.referral_reward',
  ADMIN_JOB_NOTIFICATIONS_CLEANUP: 'admin.job.notifications_cleanup',
  ADMIN_JOB_TELEMETRY_CLEANUP: 'admin.job.telemetry_cleanup',
  ADMIN_JOB_DAILY_ENGAGEMENT: 'admin.job.daily_engagement',

  // ── Cleanup (cron-driven, no producer) ─────────────────────────────────
  /**
   * @deprecated Unused — the audit-cleanup job runs on a direct
   * timer in workers/index.ts, not the outbox path. Scheduled for
   * removal in v0.4.
   */
  AUDIT_LOG_CLEANUP: 'cleanup.audit_log',
  /**
   * @deprecated Unused — the telemetry-cleanup job runs on a direct
   * timer in workers/index.ts, not the outbox path. Scheduled for
   * removal in v0.4.
   */
  TELEMETRY_DATA_CLEANUP: 'cleanup.telemetry',
} as const;

export type OutboxEventType = (typeof OutboxEventTypes)[keyof typeof OutboxEventTypes];

/**
 * PR-75: Priority levels for outbox events. Interactive events
 * (rent-due SMS, referral rewards, FCM dispatch, daily engagement)
 * are polled by the worker before background events. Background
 * is the safe default for any event type that has not been
 * classified — it matches the pre-PR-75 FIFO order.
 */
export type OutboxPriority = 'interactive' | 'background';

/**
 * Maximum serialized payload size for a single outbox event.
 * 64 KB is large enough for any realistic event (a wallet ledger
 * entry, a notification with FCM token, a referral record, etc.)
 * but small enough that a misbehaving producer cannot fill the
 * outbox table with megabytes of garbage.
 *
 * If a producer tries to emit a payload larger than this, the emit
 * call throws OutboxPayloadTooLargeError. The transaction is rolled
 * back so the outbox is never partially written.
 */
export const MAX_OUTBOX_PAYLOAD_BYTES = 64 * 1024;

/**
 * Thrown by OutboxService.emit() when the serialized payload exceeds
 * MAX_OUTBOX_PAYLOAD_BYTES. Caught at the route boundary as a 500
 * (after we log the offending eventType so the operator can find
 * the buggy producer).
 */
export class OutboxPayloadTooLargeError extends Error {
  readonly eventType: OutboxEventType;
  readonly actualBytes: number;
  readonly limitBytes: number;

  constructor(eventType: OutboxEventType, actualBytes: number, limitBytes: number) {
    super(
      `Outbox payload for event '${eventType}' is ${actualBytes} bytes, ` +
        `exceeds the ${limitBytes}-byte limit. Either split the event ` +
        `into smaller sub-events or store the large payload in storage ` +
        `and reference it by URL in the event payload.`
    );
    this.name = 'OutboxPayloadTooLargeError';
    this.eventType = eventType;
    this.actualBytes = actualBytes;
    this.limitBytes = limitBytes;
  }
}

export const OutboxService = {
  /**
   * Write an event to the outbox table. The worker will pick it up later.
   *
   * Pass a Prisma transaction client (`tx`) when called inside a
   * prisma.$transaction() to get atomic business writes + outbox event.
   * Without the tx param, it writes directly to the database.
   *
   * `priority` (PR-75) controls where the event sits in the claim
   * order. Defaults to 'background' so callers that don't pass it
   * keep the pre-PR-75 behavior. Interactive events (rent-due SMS,
   * FCM dispatch, etc.) MUST pass 'interactive' to avoid being
   * starved by long-running background jobs.
   *
   * Throws OutboxPayloadTooLargeError if the serialized payload
   * exceeds MAX_OUTBOX_PAYLOAD_BYTES. The throw is BEFORE the DB
   * write, so no partial state is created.
   */
  async emit(
    eventType: OutboxEventType,
    payload: Record<string, unknown>,
    maxAttempts = 3,
    tx?: Prisma.TransactionClient,
    priority: OutboxPriority = 'background'
  ): Promise<string> {
    // Validate payload size before any DB work. Serializing here
    // (instead of in Prisma) keeps the threshold check transparent
    // and avoids an extra round-trip for events that would fail.
    const serialized = JSON.stringify(payload);
    const sizeBytes = Buffer.byteLength(serialized, 'utf8');
    if (sizeBytes > MAX_OUTBOX_PAYLOAD_BYTES) {
      logger.error('[Outbox] Payload exceeds size cap', {
        eventType,
        actualBytes: sizeBytes,
        limitBytes: MAX_OUTBOX_PAYLOAD_BYTES,
      });
      throw new OutboxPayloadTooLargeError(
        eventType,
        sizeBytes,
        MAX_OUTBOX_PAYLOAD_BYTES
      );
    }

    const client = tx || db;
    try {
      const event = await client.outboxEvent.create({
        data: {
          eventType,
          payload: serialized,
          status: 'PENDING',
          maxAttempts,
          priority,
        },
        select: { id: true },
      });

      logger.debug('[Outbox] Event emitted', { eventType, eventId: event.id, priority });
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
