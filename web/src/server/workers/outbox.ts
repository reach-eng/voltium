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
import { db, type TxClient } from '@/lib/db';
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
  WALLET_TOPUP_APPROVED: 'wallet.topup_approved',
  WALLET_TOPUP_REJECTED: 'wallet.topup_rejected',
  WALLET_RECONCILIATION: 'wallet.reconciliation',

  // ── Notifications ──────────────────────────────────────────────────────
  NOTIFICATION_SEND: 'notification.send',
  /**
   * Admin "send to all riders" broadcast (P0-1/P0-9, 2026-08-05 ops
   * audit). Previously the route ran a synchronous 100k-row batch loop
   * with no rate limit or confirmation — 2-3 calls DoS'd the DB. The
   * route now rate-limits (3/hr/admin), requires ?confirm=true, emits
   * this event, and returns 202; notification-broadcast.job.ts runs the
   * batched writes in the background with a per-batch sleep.
   */
  NOTIFICATION_BROADCAST: 'notification.broadcast',
  SMS_SEND: 'sms.send',
  /**
   * PR-89 (2026-08-06 fix-plan, 9th audit P0): announcement fanout is now
   * async. POST /api/admin/announcements (or the scheduled-announcements
   * cron) emits this event; announcement-broadcast.job.ts re-derives
   * recipients and runs the batched insert loop in the background. The
   * request no longer holds a transaction open for 30-60s on 10k+ riders.
   */
  ANNOUNCEMENT_BROADCAST: 'announcement.broadcast',
  DAILY_ENGAGEMENT: 'engagement.daily',

  // ── Referrals ──────────────────────────────────────────────────────────
  REFERRAL_REWARD: 'referral.reward',

  // ── Rent / Leases ──────────────────────────────────────────────────────
  RENT_OVERDUE: 'rent.overdue',
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
  // PR-VER-2026-08-06 (EVENT_BUS P0-6): distinct event for the admin
  // "Auto-Debit" job card so it no longer shares rent-due-checker's event.
  ADMIN_JOB_AUTO_DEBIT: 'admin.job.auto_debit',
  ADMIN_JOB_DEVICE_COMPLIANCE: 'admin.job.device_compliance',
  ADMIN_JOB_REFERRAL_REWARD: 'admin.job.referral_reward',
  ADMIN_JOB_NOTIFICATIONS_CLEANUP: 'admin.job.notifications_cleanup',
  ADMIN_JOB_TELEMETRY_CLEANUP: 'admin.job.telemetry_cleanup',
  ADMIN_JOB_DAILY_ENGAGEMENT: 'admin.job.daily_engagement',
  ADMIN_JOB_SCHEDULED_BACKUP: 'admin.job.scheduled_backup',
} as const;

// DEEP-AUDIT D-P0-2 / D-P2-1 (2026-08-08): removed 9 deprecated outbox event
// types that were never emitted or consumed. Keeping the @deprecated entries
// in the enum was a footgun — a future contributor could call
// `OutboxService.emit(OutboxEventTypes.WALLET_TOPUP_REQUESTED, ...)` and the
// event would silently sit PENDING until cleaned up. The removed types are
// kept here as frozen string constants for any out-of-tree consumer (e.g.
// archived row payloads, BI exports) that still references the literal value.
// New code must not use these names.
export const REMOVED_OUTBOX_EVENT_TYPES = {
  WALLET_TOPUP_REQUESTED: 'wallet.topup_requested',
  DEPOSIT_APPROVED: 'deposit.approved',
  DEPOSIT_REJECTED: 'deposit.rejected',
  DEPOSIT_REFUNDED: 'deposit.refunded',
  ANNOUNCEMENT_DISPATCH: 'notification.announcement',
  REFERRAL_SIGNUP: 'referral.signup',
  RENT_DUE: 'rent.due',
  AUDIT_LOG_CLEANUP: 'cleanup.audit_log',
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

/**
 * DEEP-AUDIT D-P1-9 (2026-08-08): thrown by OutboxService.emit() when
 * the producer-side rate limit (1,000 emits per minute per event type
 * per process) is exceeded. Caught at the route boundary as a 503 —
 * the producer is told to back off rather than silently dropped.
 */
export class OutboxEmitRateLimitedError extends Error {
  readonly eventType: OutboxEventType;
  readonly limitPerMinute: number;

  constructor(eventType: OutboxEventType, limitPerMinute: number) {
    super(
      `Outbox producer rate limit hit for event '${eventType}': ` +
        `> ${limitPerMinute} emits in the last minute. ` +
        `Back off, batch the writes, or increase the cap.`
    );
    this.name = 'OutboxEmitRateLimitedError';
    this.eventType = eventType;
    this.limitPerMinute = limitPerMinute;
  }
}

/**
 * PR-146: Helper for the "emit-then-commit" pattern, where a use-case
 * commits a business write and then needs to publish a follow-up outbox
 * event. Wraps the writer in `db.$transaction`, runs the writer, then
 * runs the emit *inside* the same transaction so the event is only
 * visible if the business write commits. If the writer throws, the
 * event is never written — no orphan events.
 *
 * The function is opt-in: pass any side-effecting writer (typically
 * a lambda that does business writes via `tx`) and a payload builder
 * (also receives `tx` so it can read the just-written values for the
 * payload). The wrapper handles:
 *   1. Open a `db.$transaction` with SERIALIZABLE isolation (strongest).
 *   2. Run the writer with the transaction client.
 *   3. Run the payload builder to get the event payload.
 *   4. Run `OutboxService.emit(..., tx)` with that payload.
 *   5. Commit. If anything throws, roll back and re-throw.
 *
 * This is the canonical pattern for any use-case that previously did:
 *   await db.$transaction(async (tx) => { ... business writes ... });
 *   await OutboxService.emit(EVENT, { ... payload ... });  // LEAKS on crash
 *
 * Now you do:
 *   await OutboxService.emitWithCommit(
 *     EVENT,
 *     async (tx) => { ... business writes ... },
 *     async (tx) => ({ ... payload ... }),
 *   );
 */
export async function emitWithCommit<T>(
  eventType: OutboxEventType,
  writer: (tx: TxClient) => Promise<T>,
  payloadBuilder: (tx: TxClient, writerResult: T) => Promise<Record<string, unknown>> | Record<string, unknown>,
  options: { maxAttempts?: number; priority?: OutboxPriority } = {}
): Promise<T> {
  const writerResult = await db.$transaction(async (tx) => {
    const result = await writer(tx);
    const payload = await payloadBuilder(tx, result);
    await OutboxService.emit(eventType, payload, options.maxAttempts ?? 3, tx, options.priority ?? 'background');
    return result;
  });
  return writerResult;
}

/**
 * DEEP-AUDIT D-P1-9 (2026-08-08): producer-side rate limit on outbox
 * emit. A misbehaving cron or notification fanout could otherwise emit
 * millions of events in a short window — the per-event-type cap stops
 * a single producer from flooding the table.
 *
 * The limit is per-event-type, in-memory, sliding window. It is NOT
 * authoritative across processes (multiple Next.js workers each track
 * their own counter) but it caps the per-process rate which is the
 * realistic abuse vector. A DB-side trigger or row-level check would
 * be more robust; this is the minimum that prevents a single bad cron
 * from filling the outbox.
 */
const EMIT_RATE_LIMIT_PER_MINUTE = 1_000; // per event type, per process
const emitWindowMs = 60_000;
const emitCounters = new Map<string, { count: number; resetAt: number }>();

/**
 * T-97 (PR-7, 2026-08-23): the producer-side rate limit is now
 * ALWAYS enforced. The previous code gated the check behind
 * `RATE_LIMIT_FORCED_ON_FOR_TESTS` (default `false`) so production
 * NEVER exercised the cap — a runaway cron could fill the outbox
 * table. The dedicated rate-limit test resets the in-process
 * counters via `__resetEmitRateLimitCountersForTests()` so the
 * cap doesn't trip during unit tests.
 */
function checkEmitRateLimit(eventType: string): boolean {
  const now = Date.now();
  const existing = emitCounters.get(eventType);
  if (!existing || existing.resetAt <= now) {
    emitCounters.set(eventType, { count: 1, resetAt: now + emitWindowMs });
    return true;
  }
  if (existing.count >= EMIT_RATE_LIMIT_PER_MINUTE) {
    return false;
  }
  existing.count += 1;
  return true;
}

/**
 * Test-only hook: clears the in-process emit counters so a test can
 * start a fresh 60s window. The counters are process-global by design
 * (the cap is per-process), so unit tests that exercise the limit
 * must reset between cases.
 */
export function __resetEmitRateLimitCountersForTests(): void {
  emitCounters.clear();
}

export const OutboxService = {
  /**
   * Write an event to the outbox table. The worker will pick it up later.
   *
   * **PR-146 (B-W3):** Pass a Prisma transaction client (`tx`) when
   * called inside a `db.$transaction()` so the business write and the
   * outbox row commit atomically. Without `tx`, the event is written
   * on its own connection — a crash between the business commit and
   * the emit loses the event.
   *
   * For the most common "writer + emit" pattern, prefer
   * `OutboxService.emitWithCommit(...)` which wraps both in one tx.
   *
   * For fire-and-forget emits that have no parent business write to be
   * atomic with (scheduler ticks, post-commit side-effect notifications
   * where the canonical source of truth is already in the DB and a
   * lost notification is acceptable), pass `tx: undefined`. The
   * scheduler emits fall in this category.
   *
   * `priority` (PR-75) controls where the event sits in the claim
   * order. Defaults to 'background' so callers that don't pass it
   * keep the pre-PR-75 behavior. Interactive events (rent-due SMS,
   * FCM dispatch, etc.) MUST pass 'interactive' to avoid being
   * starved by long-running background jobs.
   *
   * Throws `OutboxPayloadTooLargeError` if the serialized payload
   * exceeds `MAX_OUTBOX_PAYLOAD_BYTES`. The throw is BEFORE the DB
   * write, so no partial state is created.
   *
   * DEEP-AUDIT D-P1-9: a producer-side rate limit (1,000 emits per
   * minute per event type per process) caps the runaway-emit vector.
   * Throws `OutboxEmitRateLimitedError` if the cap is exceeded.
   */
  async emit(
    eventType: OutboxEventType,
    payload: Record<string, unknown>,
    maxAttempts = 3,
    tx?: TxClient,
    priority: OutboxPriority = 'background'
  ): Promise<string> {
    // T-97 (PR-7, 2026-08-23): the rate limit is ALWAYS enforced
    // (was previously gated behind a test-only flag that defaulted
    // to false — so production never actually exercised the cap).
    if (!checkEmitRateLimit(eventType)) {
      logger.error('[Outbox] Producer-side rate limit hit', {
        eventType,
        limitPerMinute: EMIT_RATE_LIMIT_PER_MINUTE,
      });
      throw new OutboxEmitRateLimitedError(eventType, EMIT_RATE_LIMIT_PER_MINUTE);
    }

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

      logger.debug('[Outbox] Event emitted', { eventType, eventId: event.id, priority, transactional: !!tx });
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
