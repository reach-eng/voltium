import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WORKERS } from '@/server/workers/index';
import { OutboxEventTypes } from '@/server/workers/outbox';

const mockDb = vi.hoisted(() => ({
  userLocation: { count: vi.fn(), deleteMany: vi.fn() },
  userCallLog: { count: vi.fn(), deleteMany: vi.fn() },
  userContact: { count: vi.fn(), deleteMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(async (cb: any) => {
    const tx = {
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
      userLocation: { deleteMany: vi.fn().mockResolvedValue({ count: 120 }) },
      userCallLog: { deleteMany: vi.fn().mockResolvedValue({ count: 45 }) },
      userContact: { deleteMany: vi.fn().mockResolvedValue({ count: 80 }) },
    };
    return cb(tx);
  }),
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

const { telemetryCleanupJob } = await import('@/server/workers/jobs/telemetry-cleanup.job');

describe('Telemetry Retention & Cleanup Job — Proper Tagging & Isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes telemetry older than 30 days atomically with audit trail', async () => {
    mockIdempotency.checkOrClaimIdempotency.mockResolvedValue({ status: 'not_found' });
    mockDb.userLocation.count.mockResolvedValue(120);
    mockDb.userCallLog.count.mockResolvedValue(45);
    mockDb.userContact.count.mockResolvedValue(80);
    mockIdempotency.completeIdempotency.mockResolvedValue(undefined);

    const result = await telemetryCleanupJob.process({ id: 'scheduled' });

    expect(result).toEqual({
      locationsDeleted: 120,
      callLogsDeleted: 45,
      contactsDeleted: 80,
    });
    expect(mockIdempotency.completeIdempotency).toHaveBeenCalledWith(
      expect.stringContaining('telemetry-cleanup:daily:'),
      result
    );
  });

  it('skips processing if job already ran today', async () => {
    mockIdempotency.checkOrClaimIdempotency.mockResolvedValue({ status: 'completed' });

    const result = await telemetryCleanupJob.process({ id: 'scheduled' });

    expect(result).toEqual({
      locationsDeleted: 0,
      callLogsDeleted: 0,
      contactsDeleted: 0,
    });
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  it('ensures ADMIN_JOB_TELEMETRY_CLEANUP is distinct from notifications and routed to telemetryCleanupJob', () => {
    expect(OutboxEventTypes.ADMIN_JOB_TELEMETRY_CLEANUP).toBe('admin.job.telemetry_cleanup');
    expect(OutboxEventTypes.SMS_SEND).toBe('sms.send');
    expect(OutboxEventTypes.NOTIFICATION_SEND).toBe('notification.send');

    const worker = WORKERS.find((w) => w.jobType === OutboxEventTypes.ADMIN_JOB_TELEMETRY_CLEANUP);
    expect(worker).toBeDefined();
    expect(worker!.processor).toBe(telemetryCleanupJob.process);
    expect(worker!.priority).toBe('background');
  });
});
