/**
 * TG-7 (audits/2026-08-05-scheduled-cron-tasks.md:595): scheduled-backup skips when
 * BACKUP_LOCK_STATUS === 'RESTORE_RUNNING'
 *
 * The scheduled backup job must NOT start a backup while a restore
 * operation is in progress. The check is at scheduled-backup.job.ts:60-64:
 *
 *   const backupLock = await db.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_STATUS' } });
 *   if (backupLock?.value === 'RESTORE_RUNNING') {
 *     return { ran: false, reason: 'Restore operation is in progress — backup skipped' };
 *   }
 *
 * `checkAndRun` has a long sequence of pre-flight checks (no schedule,
 * schedule disabled, a backup already running, maintenance mode)
 * before reaching the BACKUP_LOCK check. These tests stub all of
 * them so the BACKUP_LOCK check is the gate under test.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetSchedule = vi.fn();
const mockFindRunningBackup = vi.fn();
const mockMarkScheduleSuccess = vi.fn();
const mockMarkScheduleFailure = vi.fn();
const mockSystemSettingFindUnique = vi.fn();
const mockGetFreeDiskBytes = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockRunScheduledBackup = vi.fn();

const mockClockNow = vi.fn();
const mockComputeNextRunAt = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    systemSetting: {
      findUnique: mockSystemSettingFindUnique,
      upsert: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('@/server/modules/data-management/backup.repository', () => ({
  backupRepository: {
    getSchedule: mockGetSchedule,
    findRunningBackup: mockFindRunningBackup,
    markScheduleSuccess: mockMarkScheduleSuccess,
    markScheduleFailure: mockMarkScheduleFailure,
  },
}));

vi.mock('@/server/modules/data-management/backup.service', () => ({
  backupService: { runScheduledBackup: mockRunScheduledBackup },
  getFreeDiskBytes: mockGetFreeDiskBytes,
}));

vi.mock('@/server/modules/data-management/schedule/schedule.service', () => ({
  scheduleService: { calculateNextRun: vi.fn().mockReturnValue(new Date('2026-09-09T02:00:00Z')) },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mockCreateAuditLog,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/clock', () => ({
  clock: { now: mockClockNow },
}));

const { scheduledBackupJob } = await import(
  '@/server/workers/jobs/scheduled-backup.job'
);

const NOW = new Date('2026-09-02T02:00:00Z');
const SCHEDULE = {
  id: 'sched-1',
  frequency: 'DAILY',
  timeOfDay: '02:00',
  enabled: true,
  nextRunAt: new Date('2026-09-02T01:00:00Z'), // overdue
  minimumFreeDiskGb: 5,
  includeDatabase: true,
  includeUploads: true,
  retentionDays: 30,
};

// Stub the computeNextRunAt import (it's a local function in the
// scheduled-backup.job.ts module — we stub the module path it imports
// from if needed; here the schedule is overdue so the code path
// reaches `computeNextRunAt` only when a backup actually runs).
// For BACKUP_LOCK tests we never reach the backup body.

async function setupHappyPreFlight() {
  mockGetSchedule.mockResolvedValue(SCHEDULE);
  mockFindRunningBackup.mockResolvedValue(null);
  mockClockNow.mockReturnValue(NOW);
  // System settings — first call is MAINTENANCE_MODE, second is BACKUP_LOCK_STATUS
  // (in test order — but the code may short-circuit before reading the second)
  // We make this mock return values based on a key matcher.
  mockSystemSettingFindUnique.mockImplementation(async ({ where }: any) => {
    if (where.key === 'MAINTENANCE_MODE') return null;
    if (where.key === 'BACKUP_LOCK_STATUS') return null;
    return null;
  });
  mockGetFreeDiskBytes.mockResolvedValue(50 * 1024 * 1024 * 1024); // 50 GB
  mockCreateAuditLog.mockResolvedValue(undefined);
  mockMarkScheduleSuccess.mockResolvedValue(undefined);
  mockRunScheduledBackup.mockResolvedValue({ id: 'bk-1' });
  mockMarkScheduleFailure.mockResolvedValue(undefined);
}

describe('scheduledBackupJob.checkAndRun — TG-7 BACKUP_LOCK_STATUS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips with "Restore operation is in progress" when BACKUP_LOCK_STATUS === "RESTORE_RUNNING"', async () => {
    await setupHappyPreFlight();
    mockSystemSettingFindUnique.mockImplementation(async ({ where }: any) => {
      if (where.key === 'MAINTENANCE_MODE') return null;
      if (where.key === 'BACKUP_LOCK_STATUS') {
        return { key: 'BACKUP_LOCK_STATUS', value: 'RESTORE_RUNNING' };
      }
      return null;
    });

    const result = await scheduledBackupJob.checkAndRun();

    expect(result.ran).toBe(false);
    expect(result.reason).toMatch(/Restore operation is in progress/i);
    // Critically: the backup body must NOT have executed
    expect(mockRunScheduledBackup).not.toHaveBeenCalled();
    expect(mockCreateAuditLog).not.toHaveBeenCalled();
    expect(mockMarkScheduleSuccess).not.toHaveBeenCalled();
  });

  it('proceeds to disk-space check when BACKUP_LOCK_STATUS is unset', async () => {
    await setupHappyPreFlight();
    // Both MAINTENANCE_MODE and BACKUP_LOCK_STATUS are null — happy path
    // proceeds past the lock check into disk-space + due-time checks.

    const result = await scheduledBackupJob.checkAndRun();

    expect(mockRunScheduledBackup).toHaveBeenCalledTimes(1);
    expect(result.ran).toBe(true);
  });

  it('proceeds when BACKUP_LOCK_STATUS has any value other than "RESTORE_RUNNING"', async () => {
    await setupHappyPreFlight();
    // E.g. "IDLE" or "BACKUP_RUNNING" or a stale value — the gate only
    // matches the exact string "RESTORE_RUNNING".
    mockSystemSettingFindUnique.mockImplementation(async ({ where }: any) => {
      if (where.key === 'MAINTENANCE_MODE') return null;
      if (where.key === 'BACKUP_LOCK_STATUS') {
        return { key: 'BACKUP_LOCK_STATUS', value: 'IDLE' };
      }
      return null;
    });

    const result = await scheduledBackupJob.checkAndRun();

    expect(mockRunScheduledBackup).toHaveBeenCalledTimes(1);
    expect(result.ran).toBe(true);
  });
});
