/**
 * Phase W10 — Observability & Infrastructure (PR-O)
 *
 * Unit tests covering:
 *   I-1: Manual backup event handling & worker registration
 *   I-2: Backup lock 30-min TTL expiration & stale backup job reaper
 *   I-3: Outbox reaper timeout sizing for broadcast & backup event types
 *   I-5: Analytics IST month key formatter & monthly trend aggregation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scheduledBackupJob } from '@/server/workers/jobs/scheduled-backup.job';
import { backupService } from '@/server/modules/data-management/backup.service';
import { toIstMonthKey } from '@/server/modules/analytics/analytics.use-cases';
import { WORKERS } from '@/server/workers';
import { OutboxEventTypes } from '@/server/workers/outbox';

describe('Phase W10: Observability & Infrastructure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('I-1: Manual Backup Worker Wiring', () => {
    it('registers ADMIN_JOB_SCHEDULED_BACKUP worker in WORKERS array', () => {
      const worker = WORKERS.find((w) => w.jobType === OutboxEventTypes.ADMIN_JOB_SCHEDULED_BACKUP);
      expect(worker).toBeDefined();
      expect(worker?.priority).toBe('background');
      expect(worker?.concurrency).toBe(1);
    });

    it('scheduledBackupJob.process executes manual backup for MANUAL payload', async () => {
      const createBackupSpy = vi
        .spyOn(backupService, 'createBackup')
        .mockResolvedValueOnce({ id: 'backup-manual-1' } as any);

      const result = await scheduledBackupJob.process({
        id: 'job-1',
        payload: { type: 'MANUAL', adminId: 'admin-1' },
      });

      expect(result.ran).toBe(true);
      expect(createBackupSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'MANUAL' })
      );
    });

    it('scheduledBackupJob.process delegates to checkAndRun when no manual type', async () => {
      const checkAndRunSpy = vi
        .spyOn(scheduledBackupJob, 'checkAndRun')
        .mockResolvedValueOnce({ ran: true });

      const result = await scheduledBackupJob.process({
        id: 'job-2',
        payload: { scheduleId: 'sched-1' },
      });

      expect(result.ran).toBe(true);
      expect(checkAndRunSpy).toHaveBeenCalled();
    });
  });

  describe('I-2: Backup Lock TTL Expiration & Stale Job Reaper', () => {
    it('acquireLock succeeds when lock is held but has exceeded 30-min TTL', async () => {
      const dbMock = (await import('@/lib/db')).db;
      const expiredTimestamp = new Date(Date.now() - 40 * 60 * 1000).toISOString();

      vi.spyOn(dbMock, '$transaction').mockImplementation(async (cb: any) => {
        const txMock = {
          systemSetting: {
            findUnique: vi.fn().mockImplementation(({ where }) => {
              if (where.key === 'BACKUP_LOCK_STATUS') return Promise.resolve({ value: 'BACKUP_RUNNING' });
              if (where.key === 'BACKUP_LOCK_STARTED_AT') return Promise.resolve({ value: expiredTimestamp });
              return Promise.resolve(null);
            }),
            upsert: vi.fn().mockResolvedValue({}),
          },
        };
        return cb(txMock);
      });

      const acquired = await backupService.acquireLock('BACKUP_RUNNING', 'test-owner');
      expect(acquired).toBe(true);
    });

    it('acquireLock rejects when lock was started recently (<30 min)', async () => {
      const dbMock = (await import('@/lib/db')).db;
      const recentTimestamp = new Date(Date.now() - 5 * 60 * 1000).toISOString();

      vi.spyOn(dbMock, '$transaction').mockImplementation(async (cb: any) => {
        const txMock = {
          systemSetting: {
            findUnique: vi.fn().mockImplementation(({ where }) => {
              if (where.key === 'BACKUP_LOCK_STATUS') return Promise.resolve({ value: 'BACKUP_RUNNING' });
              if (where.key === 'BACKUP_LOCK_STARTED_AT') return Promise.resolve({ value: recentTimestamp });
              return Promise.resolve(null);
            }),
            upsert: vi.fn().mockResolvedValue({}),
          },
        };
        return cb(txMock);
      });

      const acquired = await backupService.acquireLock('BACKUP_RUNNING', 'test-owner');
      expect(acquired).toBe(false);
    });

    it('reapStaleBackupJobs updates abandoned RUNNING/QUEUED jobs to FAILED', async () => {
      const dbMock = (await import('@/lib/db')).db;
      const updateManySpy = vi
        .spyOn(dbMock.backupJob, 'updateMany')
        .mockResolvedValueOnce({ count: 3 } as any);

      const count = await backupService.reapStaleBackupJobs(60);
      expect(count).toBe(3);
      expect(updateManySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['RUNNING', 'QUEUED'] },
          }),
          data: expect.objectContaining({
            status: 'FAILED',
          }),
        })
      );
    });
  });

  describe('I-3: Outbox Reaper Query Execution', () => {
    it('runReaper executes raw query and returns reclaimed count', async () => {
      const { JobQueue } = await import('@/lib/job-queue');
      const dbMock = (await import('@/lib/db')).db;
      vi.spyOn(dbMock, '$executeRaw').mockResolvedValueOnce(2 as any);

      const reclaimed = await JobQueue.runReaper();
      expect(reclaimed).toBe(2);
    });
  });

  describe('I-5: Analytics IST Month Key & Trend Bucketing', () => {
    it('toIstMonthKey formats UTC dates correctly across the IST boundary', () => {
      // 2026-01-31 19:00:00 UTC is 2026-02-01 00:30:00 IST -> should be 2026-02
      const utcEndOfJan = new Date('2026-01-31T19:00:00.000Z');
      expect(toIstMonthKey(utcEndOfJan)).toBe('2026-02');

      // 2026-01-31 17:00:00 UTC is 2026-01-31 22:30:00 IST -> should be 2026-01
      const utcJanStill = new Date('2026-01-31T17:00:00.000Z');
      expect(toIstMonthKey(utcJanStill)).toBe('2026-01');
    });

    it('getMonthlyTrend aggregates revenue into 12 IST month buckets', async () => {
      const { analyticsUseCases } = await import('@/server/modules/analytics/analytics.use-cases');
      const dbMock = (await import('@/lib/db')).db;

      vi.spyOn(dbMock.rider, 'count').mockResolvedValue(10);
      vi.spyOn(dbMock.vehicle, 'count').mockResolvedValue(5);
      vi.spyOn(dbMock.transaction, 'aggregate').mockResolvedValue({ _sum: { amountInPaise: 50000 } } as any);
      vi.spyOn(dbMock.rider, 'findMany').mockResolvedValue([]);
      vi.spyOn(dbMock.transaction, 'findMany').mockResolvedValue([
        {
          createdAt: new Date(),
          amountInPaise: 100000, // ₹1,000
        },
      ] as any);

      const overview = await analyticsUseCases.getOverview();
      expect(overview.trend.length).toBe(12);
      const currentMonthKey = toIstMonthKey(new Date());
      const currentMonthBucket = overview.trend.find((b) => b.month === currentMonthKey);
      expect(currentMonthBucket?.revenue).toBe(1000);
    });
  });
});
