/**
 * T-92 (PR-2, 2026-08-23) — regression test for the
 * `calculateNextRun` null-instead-of-now fix. The previous code
 * did `nextRunAt ?? clock.now()` which converted `null`
 * (MANUAL / unparseable `timeOfDay`) into a tight-loop schedule
 * that filled the disk with backup files every minute. The
 * fix persists `nextRunAt = null` and lets the schedule stay
 * dormant.
 *
 * See docs/AUDIT_WORKFLOWS_2026-08-23.md §2.1.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const markScheduleSuccessMock = vi.fn();
const getScheduleMock = vi.fn();
const findRunningBackupMock = vi.fn();
const runScheduledBackupMock = vi.fn();
const calculateNextRunMock = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    backupSchedule: { findFirst: vi.fn() },
    systemSetting: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    rider: { findMany: vi.fn() },
    outboxEvent: { create: vi.fn() },
  },
}));

vi.mock('@/server/modules/data-management/backup.repository', () => ({
  backupRepository: {
    markScheduleSuccess: (...args: unknown[]) => markScheduleSuccessMock(...args),
    markScheduleFailure: vi.fn().mockResolvedValue({}),
    getSchedule: (...args: unknown[]) => getScheduleMock(...args),
    findRunningBackup: (...args: unknown[]) => findRunningBackupMock(...args),
    findActiveSchedule: vi.fn(),
  },
}));

vi.mock('@/server/modules/data-management/backup.service', () => ({
  backupService: {
    runScheduledBackup: (...args: unknown[]) => runScheduledBackupMock(...args),
  },
  getFreeDiskBytes: vi.fn().mockResolvedValue(100 * 1024 * 1024 * 1024),
}));

vi.mock('@/server/modules/data-management/schedule/schedule.service', () => ({
  scheduleService: {
    calculateNextRun: (...args: unknown[]) => calculateNextRunMock(...args),
  },
}));

vi.mock('@/lib/alerter', () => ({
  alerter: { send: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { scheduledBackupJob } from '@/server/workers/jobs/scheduled-backup.job';

describe('T-92 calculateNextRun null no longer triggers tight loop', () => {
  beforeEach(() => {
    markScheduleSuccessMock.mockReset();
    getScheduleMock.mockReset();
    findRunningBackupMock.mockReset();
    runScheduledBackupMock.mockReset();
    calculateNextRunMock.mockReset();
    markScheduleSuccessMock.mockResolvedValue({});
    findRunningBackupMock.mockResolvedValue(null);
    runScheduledBackupMock.mockResolvedValue({
      id: 'backup-1',
      backupId: 'backup-1',
      sizeBytes: 1024,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('persists nextRunAt=null when calculateNextRun returns null (no loop)', async () => {
    // T-92: the previous code did `nextRunAt ?? clock.now()`,
    // turning null into "now" → infinite loop.
    calculateNextRunMock.mockReturnValue(null);
    getScheduleMock.mockResolvedValue({
      id: 'sched-1',
      enabled: true,
      frequency: 'MANUAL',
      timeOfDay: '02:00',
      keepDaily: 7,
      keepWeekly: 4,
      keepMonthly: 12,
      keepManual: 10,
      includeDatabase: true,
      includeUploads: false,
      includeLogs: false,
      minimumFreeDiskGb: 10,
      primaryBackupRoot: '/tmp/backup',
      secondaryBackupRoot: null,
      nextRunAt: new Date(Date.now() - 1000),
    });

    const result = await scheduledBackupJob.checkAndRun();
    expect(result.ran).toBe(true);
    // The markScheduleSuccess call MUST receive `null`, not
    // `clock.now()`. The 3rd arg shape is the test's contract.
    expect(markScheduleSuccessMock).toHaveBeenCalledTimes(1);
    const args = markScheduleSuccessMock.mock.calls[0];
    expect(args[2]).toBeNull();
  });

  it('persists a real Date when calculateNextRun returns one', async () => {
    // T-92: a normal DAILY/02:00 schedule still gets its
    // computed next run time.
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    calculateNextRunMock.mockReturnValue(tomorrow);
    getScheduleMock.mockResolvedValue({
      id: 'sched-2',
      enabled: true,
      frequency: 'DAILY',
      timeOfDay: '02:00',
      keepDaily: 7,
      keepWeekly: 4,
      keepMonthly: 12,
      keepManual: 10,
      includeDatabase: true,
      includeUploads: false,
      includeLogs: false,
      minimumFreeDiskGb: 10,
      primaryBackupRoot: '/tmp/backup',
      secondaryBackupRoot: null,
      nextRunAt: new Date(Date.now() - 1000),
    });

    const result = await scheduledBackupJob.checkAndRun();
    expect(result.ran).toBe(true);
    expect(markScheduleSuccessMock).toHaveBeenCalledTimes(1);
    const args = markScheduleSuccessMock.mock.calls[0];
    expect(args[2]).toBe(tomorrow);
  });
});
