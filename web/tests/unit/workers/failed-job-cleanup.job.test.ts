import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.hoisted(() => ({
  outboxEvent: { deleteMany: vi.fn() },
  backupJob: { deleteMany: vi.fn() },
  restoreJob: { deleteMany: vi.fn() },
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

const { failedJobCleanupJob } = await import('@/server/workers/jobs/failed-job-cleanup.job');

describe('Failed Job Retention & Cleanup Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('purges failed outbox events, backup jobs, and restore jobs older than 30 days', async () => {
    mockIdempotency.checkOrClaimIdempotency.mockResolvedValue({ status: 'not_found' });
    mockDb.outboxEvent.deleteMany.mockResolvedValue({ count: 25 });
    mockDb.backupJob.deleteMany.mockResolvedValue({ count: 4 });
    mockDb.restoreJob.deleteMany.mockResolvedValue({ count: 1 });
    mockIdempotency.completeIdempotency.mockResolvedValue(undefined);

    const result = await failedJobCleanupJob.process({ id: 'scheduled' });

    expect(result).toEqual({
      failedOutboxDeleted: 25,
      failedBackupJobsDeleted: 4,
      failedRestoreJobsDeleted: 1,
      totalDeleted: 30,
    });
    expect(mockIdempotency.completeIdempotency).toHaveBeenCalledWith(
      expect.stringContaining('failed-job-cleanup:daily:'),
      result
    );
  });

  it('skips execution if already processed today', async () => {
    mockIdempotency.checkOrClaimIdempotency.mockResolvedValue({ status: 'completed' });

    const result = await failedJobCleanupJob.process({ id: 'scheduled' });

    expect(result).toEqual({
      failedOutboxDeleted: 0,
      failedBackupJobsDeleted: 0,
      failedRestoreJobsDeleted: 0,
      totalDeleted: 0,
    });
    expect(mockDb.outboxEvent.deleteMany).not.toHaveBeenCalled();
  });
});
