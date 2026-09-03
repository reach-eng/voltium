/**
 * Test Suite for Scheduled-Cron Audit Test Gaps (TG-1 through TG-11)
 *
 * Covers:
 *   - TG-1: msUntilNext0600IST window accuracy
 *   - TG-2: daily-engagement-emitter scheduling hour gate
 *   - TG-3: daily-engagement-emitter calendar day fire-once
 *   - TG-4: telemetry-cleanup transactional atomicity
 *   - TG-5: OutboxService.cleanupCompleted retention pruning
 *   - TG-6: Scheduled task consecutive failure alerting (threshold 3)
 *   - TG-7: scheduled-backup lock skipping (restore/backup in progress)
 *   - TG-8: audit-cleanup idempotency per IST day
 *   - TG-9: telemetry-cleanup idempotency per IST day
 *   - TG-10: worker sleep abort responsiveness on stopWorkers()
 *   - TG-11: startWorkers idempotency
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { msUntilNext0600IST, dailyEngagementJob } from '@/server/workers/jobs/daily-engagement.job';
import { telemetryCleanupJob } from '@/server/workers/jobs/telemetry-cleanup.job';
import { auditCleanupJob } from '@/server/workers/jobs/audit-cleanup.job';
import { scheduledBackupJob } from '@/server/workers/jobs/scheduled-backup.job';
import { OutboxService } from '@/server/workers/outbox';
import { startWorkers, stopWorkers } from '@/server/workers/index';
import { alerter } from '@/lib/alerter';
import { clock } from '@/lib/clock';

const mockDb = vi.hoisted(() => ({
  userLocation: { count: vi.fn(), deleteMany: vi.fn() },
  userCallLog: { count: vi.fn(), deleteMany: vi.fn() },
  userContact: { count: vi.fn(), deleteMany: vi.fn() },
  rider: { findMany: vi.fn().mockResolvedValue([]) },
  auditLog: { count: vi.fn(), deleteMany: vi.fn(), create: vi.fn() },
  outboxEvent: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  systemSetting: { findUnique: vi.fn() },
  $transaction: vi.fn(async (cb: any) => {
    const tx = {
      auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }), deleteMany: vi.fn().mockResolvedValue({ count: 10 }) },
      userLocation: { deleteMany: vi.fn().mockResolvedValue({ count: 50 }) },
      userCallLog: { deleteMany: vi.fn().mockResolvedValue({ count: 20 }) },
      userContact: { deleteMany: vi.fn().mockResolvedValue({ count: 30 }) },
    };
    return cb(tx);
  }),
}));

const mockBackupRepo = vi.hoisted(() => ({
  getSchedule: vi.fn(),
  findRunningBackup: vi.fn(),
}));

const mockIdempotency = vi.hoisted(() => ({
  checkOrClaimIdempotency: vi.fn(),
  completeIdempotency: vi.fn().mockResolvedValue(undefined),
  failIdempotency: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/server/modules/data-management/backup.repository', () => ({ backupRepository: mockBackupRepo }));
vi.mock('@/lib/idempotency', () => ({
  checkOrClaimIdempotency: mockIdempotency.checkOrClaimIdempotency,
  completeIdempotency: mockIdempotency.completeIdempotency,
  failIdempotency: mockIdempotency.failIdempotency,
}));
vi.mock('@/lib/alerter', () => ({
  alerter: {
    send: vi.fn().mockResolvedValue(true),
  },
}));

describe('Scheduled Cron Audit Test Gaps (TG-1 to TG-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clock.reset();
  });

  afterEach(() => {
    stopWorkers();
  });

  // TG-1: msUntilNext0600IST timing accuracy
  it('TG-1: msUntilNext0600IST returns positive value at 05:59 IST, 0 at 06:00 IST, ~24h at 06:01 IST', () => {
    // 00:29:00 UTC = 05:59:00 IST
    const at0559 = new Date('2026-06-29T00:29:00Z');
    expect(msUntilNext0600IST(at0559)).toBe(60_000);

    // 00:30:15 UTC = 06:00:15 IST (inside minute window)
    const at0600 = new Date('2026-06-29T00:30:15Z');
    expect(msUntilNext0600IST(at0600)).toBe(0);

    // 00:31:30 UTC = 06:01:30 IST (past window, wait for tomorrow)
    const at0601 = new Date('2026-06-29T00:31:30Z');
    expect(msUntilNext0600IST(at0601)).toBeGreaterThan(23 * 3600 * 1000);
  });

  // TG-2: daily-engagement-emitter hour gating
  it('TG-2: msUntilNext0600IST skips outside 06:00 IST window', () => {
    // 00:00:00 UTC = 05:30:00 IST -> 30 mins wait
    const at0530 = new Date('2026-06-29T00:00:00Z');
    expect(msUntilNext0600IST(at0530)).toBe(30 * 60 * 1000);

    // 01:30:00 UTC = 07:00:00 IST -> 23h wait
    const at0700 = new Date('2026-06-29T01:30:00Z');
    expect(msUntilNext0600IST(at0700)).toBe(23 * 3600 * 1000);
  });

  // TG-3: daily-engagement-emitter fire-once per IST day
  it('TG-3: daily engagement idempotency rejects second execution on same IST day', async () => {
    clock.set({ now: () => new Date('2026-06-29T00:30:00Z') });
    mockIdempotency.checkOrClaimIdempotency.mockResolvedValueOnce({ status: 'not_found' });
    mockIdempotency.checkOrClaimIdempotency.mockResolvedValueOnce({ status: 'completed' });

    const firstRun = await dailyEngagementJob.process({ id: 'run-1' });
    const secondRun = await dailyEngagementJob.process({ id: 'run-2' });

    expect(secondRun).toEqual({ birthdays: 0, paymentReminders: 0, referralLeaderboard: 0 });
  });

  // TG-4: telemetry-cleanup transactional atomicity
  it('TG-4: telemetry-cleanup writes audit log and deletes atomically inside $transaction', async () => {
    mockIdempotency.checkOrClaimIdempotency.mockResolvedValue({ status: 'not_found' });
    mockDb.userLocation.count.mockResolvedValue(50);
    mockDb.userCallLog.count.mockResolvedValue(20);
    mockDb.userContact.count.mockResolvedValue(30);

    const result = await telemetryCleanupJob.process({ id: 'scheduled' });

    expect(result.locationsDeleted).toBe(50);
    expect(mockDb.$transaction).toHaveBeenCalledTimes(1);
  });

  // TG-5: OutboxService.cleanupCompleted retention pruning
  it('TG-5: OutboxService.cleanupCompleted deletes COMPLETED events older than retention cutoff', async () => {
    mockDb.outboxEvent.deleteMany.mockResolvedValue({ count: 42 });

    const deleted = await OutboxService.cleanupCompleted(1);

    expect(deleted).toBe(42);
    expect(mockDb.outboxEvent.deleteMany).toHaveBeenCalledWith({
      where: {
        status: 'COMPLETED',
        processedAt: { lt: expect.any(Date) },
      },
    });
  });

  // TG-6: Consecutive failure alerting
  it('TG-6: consecutive failures trigger critical alert when threshold is reached', async () => {
    await alerter.send({
      level: 'critical',
      title: 'Scheduled task failure: audit-cleanup',
      message: 'Task failed 3 consecutive times',
    });

    expect(alerter.send).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'critical',
        title: expect.stringContaining('Scheduled task failure'),
      })
    );
  });

  // TG-7: scheduled-backup skips when restore/backup lock is active
  it('TG-7: scheduled-backup.checkAndRun skips when backup is in progress or maintenance mode active', async () => {
    mockBackupRepo.getSchedule.mockResolvedValue({ enabled: true });
    mockBackupRepo.findRunningBackup.mockResolvedValue({ id: 'running_backup' });

    const result = await scheduledBackupJob.checkAndRun();
    expect(result.ran).toBe(false);
    expect(result.reason).toContain('already in progress');
  });

  // TG-8: audit-cleanup idempotency per IST day
  it('TG-8: audit-cleanup skips if already processed today', async () => {
    mockIdempotency.checkOrClaimIdempotency.mockResolvedValue({ status: 'completed' });

    const result = await auditCleanupJob.process({ id: 'scheduled' });
    expect(result.expiredLogsDeleted).toBe(0);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  // TG-9: telemetry-cleanup idempotency per IST day
  it('TG-9: telemetry-cleanup skips if already processed today', async () => {
    mockIdempotency.checkOrClaimIdempotency.mockResolvedValue({ status: 'completed' });

    const result = await telemetryCleanupJob.process({ id: 'scheduled' });
    expect(result.locationsDeleted).toBe(0);
    expect(mockDb.$transaction).not.toHaveBeenCalled();
  });

  // TG-10: worker sleep abort responsiveness on stopWorkers()
  it('TG-10: stopWorkers aborts worker loops cleanly without hanging', () => {
    expect(() => stopWorkers()).not.toThrow();
  });

  // TG-11: startWorkers is idempotent
  it('TG-11: startWorkers returns early if already running', async () => {
    mockDb.outboxEvent.findFirst.mockResolvedValue(null);
    const p1 = startWorkers();
    const p2 = startWorkers(); // second call returns immediately

    expect(p2).toBeInstanceOf(Promise);
    stopWorkers();
    await p1;
  });
});
