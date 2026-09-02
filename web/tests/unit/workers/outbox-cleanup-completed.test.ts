/**
 * TG-5 (audits/2026-08-05-scheduled-cron-tasks.md:593): OutboxService.cleanupCompleted
 *
 * Verifies the retention filter for COMPLETED outbox events:
 *   - default retention is 1 day
 *   - only COMPLETED events with `processedAt < cutoff` are deleted
 *   - PENDING + PROCESSING + FAILED are not deleted
 *   - the function returns the deleted row count
 *   - retentionDays is configurable
 *   - the cutoff uses the injected clock (so a test clock can
 *     place events in the past / future deterministically)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDeleteMany = vi.fn();
const mockClockNow = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    outboxEvent: {
      deleteMany: mockDeleteMany,
    },
  },
}));

vi.mock('@/lib/clock', () => ({
  clock: { now: mockClockNow },
}));

const { OutboxService } = await import('@/server/workers/outbox');

const FIXED_NOW = new Date('2026-09-02T12:00:00Z');

describe('OutboxService.cleanupCompleted — TG-5', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClockNow.mockReturnValue(FIXED_NOW);
    mockDeleteMany.mockResolvedValue({ count: 0 });
  });

  it('default retention is 1 day (cutoff = now - 1d)', async () => {
    await OutboxService.cleanupCompleted();

    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
    const where = mockDeleteMany.mock.calls[0][0].where;
    // cutoff should be FIXED_NOW - 1d
    const expectedCutoff = new Date(FIXED_NOW.getTime() - 24 * 60 * 60 * 1000);
    expect(where.processedAt.lt.toISOString()).toBe(expectedCutoff.toISOString());
  });

  it('queries for status COMPLETED only (not PENDING / PROCESSING / FAILED)', async () => {
    await OutboxService.cleanupCompleted();

    const where = mockDeleteMany.mock.calls[0][0].where;
    expect(where.status).toBe('COMPLETED');
  });

  it('returns the deleted count from the underlying deleteMany', async () => {
    mockDeleteMany.mockResolvedValue({ count: 42 });

    const count = await OutboxService.cleanupCompleted();
    expect(count).toBe(42);
  });

  it('honors a custom retentionDays argument (e.g. 7 days)', async () => {
    await OutboxService.cleanupCompleted(7);

    const where = mockDeleteMany.mock.calls[0][0].where;
    const expectedCutoff = new Date(FIXED_NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
    expect(where.processedAt.lt.toISOString()).toBe(expectedCutoff.toISOString());
  });

  it('uses the injected clock to compute the cutoff (testable, no Date.now)', async () => {
    // 2025-01-01 = 7 days before FIXED_NOW
    const testNow = new Date('2025-01-01T00:00:00Z');
    mockClockNow.mockReturnValue(testNow);

    await OutboxService.cleanupCompleted(3);

    const where = mockDeleteMany.mock.calls[0][0].where;
    const expectedCutoff = new Date(testNow.getTime() - 3 * 24 * 60 * 60 * 1000);
    expect(where.processedAt.lt.toISOString()).toBe(expectedCutoff.toISOString());
  });

  it('propagates DB errors instead of swallowing them', async () => {
    const dbError = new Error('postgres connection lost');
    mockDeleteMany.mockRejectedValueOnce(dbError);

    await expect(OutboxService.cleanupCompleted()).rejects.toThrow(
      'postgres connection lost'
    );
  });
});
