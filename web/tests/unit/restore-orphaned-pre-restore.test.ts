/**
 * PR-7 (2026-08-06 fix-plan, 6th audit P0): when a DR restore fails after the
 * pre-restore backup was taken, the backup must be flagged
 * ORPHANED_BY_FAILED_RESTORE:<restoreJobId> and an audit entry emitted — no
 * silent orphaned snapshots.
 *
 * Simulates a restore that fails in the verification step (after the
 * pre-restore backup was created) and asserts the catch path marks the backup
 * and writes the audit log.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const updateBackupJob = vi.fn().mockResolvedValue({});
  const updateRestoreJob = vi.fn().mockResolvedValue({});
  const auditLogs: Array<Record<string, unknown>> = [];
  const createAuditLog = vi.fn().mockImplementation(async (params: unknown) => {
    auditLogs.push(params as Record<string, unknown>);
    return {};
  });
  return {
    updateBackupJob,
    updateRestoreJob,
    auditLogs,
    createAuditLog,
    getBackupJob: vi.fn(),
    createRestoreJob: vi.fn(),
    setBackupLock: vi.fn().mockResolvedValue({}),
    verifyBackup: vi.fn(),
    createBackup: vi.fn(),
    systemSetting: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    rider: { count: vi.fn().mockResolvedValue(1) },
  };
});

vi.mock('@/lib/db', () => ({
  db: {
    systemSetting: mocks.systemSetting,
    rider: mocks.rider,
  },
}));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.createAuditLog }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/server/modules/data-management/backup.repository', () => ({
  backupRepository: {
    getBackupJob: mocks.getBackupJob,
    createRestoreJob: mocks.createRestoreJob,
    updateRestoreJob: mocks.updateRestoreJob,
    updateBackupJob: mocks.updateBackupJob,
  },
}));
vi.mock('@/server/modules/data-management/backup.service', () => ({
  backupService: {
    verifyBackup: mocks.verifyBackup,
    setBackupLock: mocks.setBackupLock,
    createBackup: mocks.createBackup,
  },
}));
vi.mock('@/lib/shell', () => ({
  restoreDatabase: vi.fn(),
  extractArchive: vi.fn(),
  runMigrations: vi.fn(),
}));
vi.mock('fs', () => ({ existsSync: vi.fn().mockReturnValue(false) }));

import { restoreService } from '@/server/modules/data-management/restore.service';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auditLogs.length = 0;
  mocks.getBackupJob.mockResolvedValue({
    id: 'backup_src',
    type: 'MANUAL',
    status: 'COMPLETED',
    databasePath: '/tmp/src/database.sql',
    filesPath: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
  });
  mocks.createRestoreJob.mockResolvedValue({ id: 'restore_1' });
  mocks.createBackup.mockResolvedValue({ id: 'backup_prerestore' });
  mocks.verifyBackup.mockResolvedValue({ valid: false, errors: ['checksum mismatch'] });
});

describe('restoreService.startRestore — orphaned pre-restore backup (PR-7)', () => {
  it('marks the pre-restore backup ORPHANED_BY_FAILED_RESTORE when verification fails after backup creation', async () => {
    await expect(
      restoreService.startRestore('backup_src', 'admin_1')
    ).rejects.toThrow('Backup verification failed');

    // The pre-restore backup was created first…
    expect(mocks.createBackup).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'PRE_RESTORE', adminId: 'admin_1' })
    );
    // …then flagged with the restore-job reference.
    expect(mocks.updateBackupJob).toHaveBeenCalledWith('backup_prerestore', {
      errorMessage: 'ORPHANED_BY_FAILED_RESTORE:restore_1',
    });

    // Audit trail carries both the failure and the orphan marker.
    const actions = mocks.auditLogs.map((l) => l.action);
    expect(actions).toContain('restore.failed');
    expect(actions).toContain('restore.orphaned_pre_restore_backup');
    const orphanEntry = mocks.auditLogs.find(
      (l) => l.action === 'restore.orphaned_pre_restore_backup'
    );
    expect(orphanEntry).toMatchObject({
      actorId: 'admin_1',
      entity: 'BackupJob',
      entityId: 'backup_prerestore',
    });
  });

  it('does NOT flag an orphan when the failure happens before the pre-restore backup is created', async () => {
    // Backup itself fails — preRestoreBackupId stays null.
    mocks.getBackupJob.mockResolvedValue(null);

    await expect(restoreService.startRestore('backup_missing', 'admin_1')).rejects.toThrow(
      'Backup job not found'
    );

    expect(mocks.createBackup).not.toHaveBeenCalled();
    expect(mocks.updateBackupJob).not.toHaveBeenCalled();
  });

  it('keeps the pre-restore backup unflagged on a fully successful restore', async () => {
    mocks.verifyBackup.mockResolvedValue({ valid: true, errors: [], warnings: [] });
    mocks.getBackupJob.mockResolvedValue({
      id: 'backup_src',
      type: 'MANUAL',
      status: 'COMPLETED',
      databasePath: null, // no DB file → skips restoreDatabase entirely
      filesPath: null,
      createdAt: new Date('2026-08-01T00:00:00Z'),
    });

    const result = await restoreService.startRestore('backup_src', 'admin_1');
    expect(result.status).toBe('COMPLETED');
    expect(mocks.updateBackupJob).not.toHaveBeenCalled();
    expect(mocks.updateRestoreJob).toHaveBeenCalledWith(
      'restore_1',
      expect.objectContaining({ status: 'COMPLETED' })
    );
  });
});
