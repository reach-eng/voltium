/**
 * DEEP-AUDIT FIX D-P1-9 (2026-08-08): producer-side rate limit on
 * outbox emit. A misbehaving cron or notification fanout could
 * otherwise emit millions of events in a short window — the
 * per-event-type cap stops a single producer from flooding the
 * table.
 *
 * Limit: 1,000 emits/min/event type/process. The 1,001st emit
 * for a single eventType must throw OutboxEmitRateLimitedError.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  outboxEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    outboxEvent: {
      create: mocks.outboxEvent.create,
    },
    $transaction: mocks.$transaction,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import AFTER the mocks are wired so the OutboxService picks
// them up.
import {
  OutboxService,
  OutboxEmitRateLimitedError,
  OutboxPayloadTooLargeError,
  OutboxEventTypes,
  __resetEmitRateLimitCountersForTests,
} from '@/server/workers/outbox';

describe('OutboxService.emit — producer-side rate limit (D-P1-9)', () => {
  beforeEach(() => {
    mocks.outboxEvent.create.mockReset();
    mocks.outboxEvent.create.mockResolvedValue({ id: 'evt-1' });
    // The emit counters are process-global with a 60s window; each case
    // must start a fresh window or the 1,000 from the previous case bleed
    // into the next one.
    //
    // T-97 (PR-7, 2026-08-23): the rate limit is now ALWAYS
    // enforced (production behavior is the same as the test
    // behavior). The previous `__forceEmitRateLimitOnForTests`
    // opt-in flag is removed. Tests reset the counter in
    // beforeEach to start each case with a fresh 1,000-emit
    // budget.
    __resetEmitRateLimitCountersForTests();
  });

  it('first 1,000 emits of WALLET_TOPUP_APPROVED in a minute succeed', async () => {
    for (let i = 0; i < 1000; i++) {
      await OutboxService.emit(
        OutboxEventTypes.WALLET_TOPUP_APPROVED,
        { i, amountInPaise: 100 },
        3,
        undefined,
        'background',
      );
    }
    expect(mocks.outboxEvent.create).toHaveBeenCalledTimes(1000);
  });

  it('1,001st emit throws OutboxEmitRateLimitedError', async () => {
    for (let i = 0; i < 1000; i++) {
      await OutboxService.emit(
        OutboxEventTypes.WALLET_TOPUP_APPROVED,
        { i },
        3,
        undefined,
        'background',
      );
    }
    // The 1,001st emit for the same eventType must throw.
    await expect(
      OutboxService.emit(
        OutboxEventTypes.WALLET_TOPUP_APPROVED,
        { over: 'limit' },
        3,
        undefined,
        'background',
      ),
    ).rejects.toBeInstanceOf(OutboxEmitRateLimitedError);
  });

  it('different eventTypes have independent buckets', async () => {
    // 1,000 SMS_SEND emits should NOT throttle WALLET_TOPUP_APPROVED.
    for (let i = 0; i < 1000; i++) {
      await OutboxService.emit(
        OutboxEventTypes.SMS_SEND,
        { i },
        3,
        undefined,
        'background',
      );
    }
    // The 1,001st SMS_SEND throws.
    await expect(
      OutboxService.emit(
        OutboxEventTypes.SMS_SEND,
        { over: 'limit' },
        3,
        undefined,
        'background',
      ),
    ).rejects.toBeInstanceOf(OutboxEmitRateLimitedError);

    // But WALLET_TOPUP_APPROVED still has its full 1,000 budget.
    await expect(
      OutboxService.emit(
        OutboxEventTypes.WALLET_TOPUP_APPROVED,
        { ok: true },
        3,
        undefined,
        'background',
      ),
    ).resolves.toBeDefined();
  });

  it('the rate-limit error names the offending eventType and the cap', async () => {
    for (let i = 0; i < 1000; i++) {
      await OutboxService.emit(
        OutboxEventTypes.NOTIFICATION_SEND,
        { i },
        3,
        undefined,
        'background',
      );
    }
    try {
      await OutboxService.emit(
        OutboxEventTypes.NOTIFICATION_SEND,
        { over: 'limit' },
        3,
        undefined,
        'background',
      );
      // Should not reach here
      expect.fail('expected OutboxEmitRateLimitedError to be thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(OutboxEmitRateLimitedError);
      const e = err as OutboxEmitRateLimitedError;
      expect(e.eventType).toBe(OutboxEventTypes.NOTIFICATION_SEND);
      expect(e.limitPerMinute).toBe(1000);
      // The error message should mention the eventType and the
      // limit so an operator grep'ing logs can find the
      // offending producer.
      expect(e.message).toContain('notification.send');
      expect(e.message).toContain('1000');
    }
  });

  it('the rate-limit error fires BEFORE the DB write (no partial state)', async () => {
    // Verify that the 1,001st emit throws without calling
    // outboxEvent.create. This is the contract: a throttled
    // emit must NEVER touch the DB.
    let createCount = 0;
    mocks.outboxEvent.create.mockImplementation(async () => {
      createCount++;
      return { id: 'evt-x' };
    });
    for (let i = 0; i < 1000; i++) {
      await OutboxService.emit(
        OutboxEventTypes.WALLET_TOPUP_REJECTED,
        { i },
        3,
        undefined,
        'background',
      );
    }
    const before = createCount;
    await expect(
      OutboxService.emit(
        OutboxEventTypes.WALLET_TOPUP_REJECTED,
        { over: 'limit' },
        3,
        undefined,
        'background',
      ),
    ).rejects.toBeInstanceOf(OutboxEmitRateLimitedError);
    expect(createCount).toBe(before); // no extra DB write
  });

  it('OutboxPayloadTooLargeError still throws before the rate limit (size check first)', async () => {
    // The size check fires first regardless of rate. A 1MB
    // payload on the first emit should throw
    // OutboxPayloadTooLargeError, not OutboxEmitRateLimitedError.
    const huge = 'x'.repeat(70_000); // > 64KB cap
    await expect(
      OutboxService.emit(
        OutboxEventTypes.WALLET_TOPUP_APPROVED,
        { data: huge },
        3,
        undefined,
        'background',
      ),
    ).rejects.toBeInstanceOf(OutboxPayloadTooLargeError);
  });
});
