import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAuditLog = vi.hoisted(() => ({
  deleteExpiredLogs: vi.fn(),
  getExpiresAt: vi.fn((action: string) => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d;
  }),
}));

const mockIdempotency = vi.hoisted(() => ({
  checkOrClaimIdempotency: vi.fn(),
  completeIdempotency: vi.fn(),
  failIdempotency: vi.fn(),
}));

vi.mock('@/lib/audit-log', () => ({
  deleteExpiredLogs: mockAuditLog.deleteExpiredLogs,
  getExpiresAt: mockAuditLog.getExpiresAt,
  RETENTION_PERIODS: {
    auth: 90,
    kyc: 365,
    rider_update: 180,
    bulk_action: 365,
    system: 30,
  },
}));

vi.mock('@/lib/idempotency', () => ({
  checkOrClaimIdempotency: mockIdempotency.checkOrClaimIdempotency,
  completeIdempotency: mockIdempotency.completeIdempotency,
  failIdempotency: mockIdempotency.failIdempotency,
}));

vi.mock('@/lib/db', () => ({
  db: {
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
  },
}));

const { auditCleanupJob } = await import('@/server/workers/jobs/audit-cleanup.job');

describe('AuditLog Retention & Cleanup Job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs deleteExpiredLogs and completes idempotency claim', async () => {
    mockIdempotency.checkOrClaimIdempotency.mockResolvedValue({ status: 'not_found' });
    mockAuditLog.deleteExpiredLogs.mockResolvedValue(150);
    mockIdempotency.completeIdempotency.mockResolvedValue(undefined);

    const result = await auditCleanupJob.process({ id: 'scheduled' });

    expect(result.expiredLogsDeleted).toBe(150);
    expect(mockAuditLog.deleteExpiredLogs).toHaveBeenCalledTimes(1);
    expect(mockIdempotency.completeIdempotency).toHaveBeenCalledWith(
      expect.stringContaining('audit-cleanup:daily:'),
      { expiredLogsDeleted: 150 }
    );
  });

  it('skips processing if job already ran today (idempotent)', async () => {
    mockIdempotency.checkOrClaimIdempotency.mockResolvedValue({ status: 'completed' });

    const result = await auditCleanupJob.process({ id: 'scheduled' });

    expect(result.expiredLogsDeleted).toBe(0);
    expect(mockAuditLog.deleteExpiredLogs).not.toHaveBeenCalled();
  });

  it('records failure in idempotency store if cleanup throws', async () => {
    mockIdempotency.checkOrClaimIdempotency.mockResolvedValue({ status: 'not_found' });
    mockAuditLog.deleteExpiredLogs.mockRejectedValue(new Error('DB connection failed'));
    mockIdempotency.failIdempotency.mockResolvedValue(undefined);

    await expect(auditCleanupJob.process({ id: 'scheduled' })).rejects.toThrow('DB connection failed');
    expect(mockIdempotency.failIdempotency).toHaveBeenCalledWith(
      expect.stringContaining('audit-cleanup:daily:')
    );
  });
});
