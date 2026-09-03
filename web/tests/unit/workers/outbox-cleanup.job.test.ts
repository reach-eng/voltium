import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.hoisted(() => ({
  outboxEvent: {
    deleteMany: vi.fn(),
  },
}));

const mockIdempotency = vi.hoisted(() => ({
  checkOrClaimIdempotency: vi.fn(),
  completeIdempotency: vi.fn(),
  failIdempotency: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/idempotency', () => ({
  checkOrClaimIdempotency: mockIdempotency.checkOrClaimIdempotency,
  completeIdempotency: mockIdempotency.completeIdempotency,
  failIdempotency: mockIdempotency.failIdempotency,
}));

const { outboxCleanupJob } = await import('@/server/workers/jobs/outbox-cleanup.job');

describe('OutboxEvent Retention & Cleanup Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('purges completed, failed, and orphan outbox events according to retention policy', async () => {
    mockIdempotency.checkOrClaimIdempotency.mockResolvedValue({ status: 'not_found' });
    mockDb.outboxEvent.deleteMany
      .mockResolvedValueOnce({ count: 50 })  // completed
      .mockResolvedValueOnce({ count: 12 })  // failed
      .mockResolvedValueOnce({ count: 5 });  // orphans
    mockIdempotency.completeIdempotency.mockResolvedValue(undefined);

    const result = await outboxCleanupJob.process({ id: 'scheduled' });

    expect(result).toEqual({
      completedDeleted: 50,
      failedDeleted: 12,
      orphansDeleted: 5,
      totalDeleted: 67,
    });
    expect(mockDb.outboxEvent.deleteMany).toHaveBeenCalledTimes(3);
    expect(mockIdempotency.completeIdempotency).toHaveBeenCalledWith(
      expect.stringContaining('outbox-cleanup:daily:'),
      result
    );
  });

  it('skips execution if already processed today', async () => {
    mockIdempotency.checkOrClaimIdempotency.mockResolvedValue({ status: 'completed' });

    const result = await outboxCleanupJob.process({ id: 'scheduled' });

    expect(result).toEqual({
      completedDeleted: 0,
      failedDeleted: 0,
      orphansDeleted: 0,
      totalDeleted: 0,
    });
    expect(mockDb.outboxEvent.deleteMany).not.toHaveBeenCalled();
  });
});
