/**
 * T-97 (PR-7, 2026-08-23) — regression test for the
 * always-on outbox rate limit. The previous code gated the
 * check behind a test-only flag that defaulted to `false`,
 * so production NEVER actually exercised the cap. The flag
 * is removed; the rate limit fires for every emit.
 *
 * See docs/AUDIT_WORKFLOWS_2026-08-23.md §2.9.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  outboxEvent: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    outboxEvent: { create: mocks.outboxEvent.create },
    $transaction: mocks.$transaction,
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import {
  OutboxService,
  OutboxEmitRateLimitedError,
  OutboxEventTypes,
  __resetEmitRateLimitCountersForTests,
} from '@/server/workers/outbox';

describe('T-97 outbox rate limit is always enforced', () => {
  beforeEach(() => {
    mocks.outboxEvent.create.mockReset();
    mocks.outboxEvent.create.mockResolvedValue({ id: 'evt-1' });
    __resetEmitRateLimitCountersForTests();
  });

  it('1,001st emit of a fresh eventType throws WITHOUT a test-flag opt-in', async () => {
    // T-97: the rate limit fires for every emit now. No test
    // flag is needed. A fresh 1,000-emit window is the
    // default; the 1,001st emit must throw.
    for (let i = 0; i < 1000; i++) {
      await OutboxService.emit(
        OutboxEventTypes.KYC_APPROVED,
        { i },
        3,
        undefined,
        'background'
      );
    }
    await expect(
      OutboxService.emit(
        OutboxEventTypes.KYC_APPROVED,
        { over: 'limit' },
        3,
        undefined,
        'background'
      )
    ).rejects.toBeInstanceOf(OutboxEmitRateLimitedError);
  });
});
