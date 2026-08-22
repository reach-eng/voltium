/**
 * PR-7 (2026-08-06 fix-plan, 6th audit P0): the orphan-backup-cleanup worker
 * purges PRE_RESTORE backups flagged ORPHANED_BY_FAILED_RESTORE once they cross
 * the 7-day operator-acknowledgement window — deleting the on-disk folder, the
 * DB row, and writing an audit entry — and stays fire-once-per-day via the
 * IST-date idempotency key.
 */

import path from 'path';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// AUDIT FIX (N-3) companion: the job's deletes are now containment-checked,
// so test fixtures must use paths INSIDE the allowed backup root (cwd/data).
const containedPath = (...segs: string[]) => path.join(process.cwd(), 'data', ...segs);

const mocks = vi.hoisted(() => {
  const findMany = vi.fn();
  const deleteBackup = vi.fn();
  const auditLogs: Array<Record<string, unknown>> = [];
  const createAuditLog = vi.fn().mockImplementation(async (params: unknown) => {
    auditLogs.push(params as Record<string, unknown>);
    return {};
  });
  return {
    findMany,
    deleteBackup,
    auditLogs,
    createAuditLog,
    rmSync: vi.fn(),
    existsSync: vi.fn(),
    checkOrClaimIdempotency: vi.fn(),
    completeIdempotency: vi.fn().mockResolvedValue({}),
    failIdempotency: vi.fn().mockResolvedValue({}),
    now: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({
  db: { backupJob: { findMany: mocks.findMany, delete: mocks.deleteBackup } },
}));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/clock', () => ({ clock: { now: mocks.now } }));
vi.mock('@/lib/date-keys', () => ({ istDateKey: () => '2026-08-06' }));
vi.mock('@/lib/idempotency', () => ({
  checkOrClaimIdempotency: mocks.checkOrClaimIdempotency,
  completeIdempotency: mocks.completeIdempotency,
  failIdempotency: mocks.failIdempotency,
}));
vi.mock('fs', () => ({ rmSync: mocks.rmSync, existsSync: mocks.existsSync }));

import { orphanBackupCleanupJob } from '@/server/workers/jobs/orphan-backup-cleanup.job';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auditLogs.length = 0;
  mocks.checkOrClaimIdempotency.mockResolvedValue({ status: 'not_found' });
  mocks.now.mockReturnValue(new Date('2026-08-15T10:00:00Z'));
  mocks.existsSync.mockReturnValue(true);
});

describe('orphanBackupCleanupJob.process — PR-7 orphan purge', () => {
  it('deletes disk folder + DB row + writes audit entry for orphans past 7 days', async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: 'backup_old',
        backupPath: containedPath('backups', 'pre_restore', 'backup_old'),
        errorMessage: 'ORPHANED_BY_FAILED_RESTORE:restore_42',
      },
    ]);
    mocks.deleteBackup.mockResolvedValue({});

    const result = await orphanBackupCleanupJob.process({ id: 'scheduled' });

    expect(result).toEqual({ purged: 1 });
    // AUDIT FIX (N-3): deletes go through safeRmBackupPath, which passes
    // the RESOLVED absolute path to rmSync.
    expect(mocks.rmSync).toHaveBeenCalledWith(
      path.resolve(containedPath('backups', 'pre_restore', 'backup_old')),
      { recursive: true, force: true }
    );
    expect(mocks.deleteBackup).toHaveBeenCalledWith({ where: { id: 'backup_old' } });
    expect(mocks.auditLogs).toContainEqual(
      expect.objectContaining({
        action: 'backup.orphan_purged',
        entity: 'BackupJob',
        entityId: 'backup_old',
        details: expect.objectContaining({ restoreJobId: 'restore_42' }),
      })
    );
    expect(mocks.completeIdempotency).toHaveBeenCalled();
  });

  it('scans only flagged PRE_RESTORE backups older than 7 days', async () => {
    mocks.findMany.mockResolvedValue([]);

    await orphanBackupCleanupJob.process({ id: 'scheduled' });

    const cutoff = new Date('2026-08-15T10:00:00Z').getTime() - 7 * 24 * 60 * 60 * 1000;
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        type: 'PRE_RESTORE',
        errorMessage: { startsWith: 'ORPHANED_BY_FAILED_RESTORE' },
        createdAt: { lt: new Date(cutoff) },
      },
      select: expect.objectContaining({ id: true }),
    });
    expect(mocks.deleteBackup).not.toHaveBeenCalled();
  });

  it('skips the run when the daily idempotency key is already claimed', async () => {
    mocks.checkOrClaimIdempotency.mockResolvedValue({ status: 'exists' });

    const result = await orphanBackupCleanupJob.process({ id: 'scheduled' });

    expect(result).toEqual({ purged: 0 });
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('keeps sweeping when a single orphan fails to purge', async () => {
    mocks.findMany.mockResolvedValue([
      { id: 'backup_bad', backupPath: containedPath('backups', 'bad'), errorMessage: 'ORPHANED_BY_FAILED_RESTORE:r1' },
      { id: 'backup_good', backupPath: containedPath('backups', 'good'), errorMessage: 'ORPHANED_BY_FAILED_RESTORE:r2' },
    ]);
    mocks.deleteBackup
      .mockRejectedValueOnce(new Error('row gone'))
      .mockResolvedValueOnce({});

    const result = await orphanBackupCleanupJob.process({ id: 'scheduled' });

    expect(result).toEqual({ purged: 1 });
    expect(mocks.deleteBackup).toHaveBeenCalledTimes(2);
  });
});
