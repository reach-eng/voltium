import { describe, it, expect, vi, beforeEach } from 'vitest';
import { restoreService } from '@/server/modules/data-management/restore.service';
import { backupRepository } from '@/server/modules/data-management/backup.repository';
import { backupService } from '@/server/modules/data-management/backup.service';
import { db } from '@/lib/db';
import * as shell from '@/lib/shell';
import { existsSync } from 'fs';

vi.mock('@/server/modules/data-management/backup.repository', () => ({
  backupRepository: {
    getBackupJob: vi.fn(),
    createRestoreJob: vi.fn(),
    updateRestoreJob: vi.fn(),
  },
}));

vi.mock('@/server/modules/data-management/backup.service', () => ({
  backupService: {
    verifyBackup: vi.fn(),
    createBackup: vi.fn().mockResolvedValue(null),
    setBackupLock: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    setting: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    systemSetting: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/shell', () => ({
  restoreDatabase: vi.fn(),
  extractArchive: vi.fn(),
  runMigrations: vi.fn(),
}));

vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  renameSync: vi.fn(),
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn(),
}));

describe('Restore Safety Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validate', () => {
    it('throws error if backup job is not found', async () => {
      vi.mocked(backupRepository.getBackupJob).mockResolvedValue(null);

      await expect(restoreService.validate('invalid-job', 'admin-1')).rejects.toThrow(
        'Backup job not found'
      );
    });

    it('throws error if backup is not completed', async () => {
      vi.mocked(backupRepository.getBackupJob).mockResolvedValue({
        id: 'job-1',
        status: 'FAILED',
        createdAt: new Date(),
        type: 'MANUAL',
      } as any);

      await expect(restoreService.validate('job-1', 'admin-1')).rejects.toThrow(
        'Cannot restore from a non-completed backup'
      );
    });

    it('returns validation results if backup is completed', async () => {
      vi.mocked(backupRepository.getBackupJob).mockResolvedValue({
        id: 'job-1',
        status: 'COMPLETED',
        createdAt: new Date(),
        type: 'MANUAL',
      } as any);

      vi.mocked(backupService.verifyBackup).mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });

      const result = await restoreService.validate('job-1', 'admin-1');
      expect(result.valid).toBe(true);
    });
  });

  describe('startRestore', () => {
    it('performs validation checks and requires backup validation success', async () => {
      vi.mocked(backupRepository.getBackupJob).mockResolvedValue({
        id: 'job-1',
        status: 'COMPLETED',
        createdAt: new Date(),
        type: 'MANUAL',
      } as any);

      vi.mocked(backupRepository.createRestoreJob).mockResolvedValue({ id: 'r-1' } as any);
      vi.mocked(backupService.verifyBackup).mockResolvedValue({
        valid: false,
        errors: ['Database dump file not found'],
        warnings: [],
      });

      await expect(restoreService.startRestore('job-1', 'admin-1')).rejects.toThrow(
        /Backup verification failed/
      );
    });

    it('creates a pre-restore backup first and locks the database', async () => {
      vi.mocked(backupRepository.getBackupJob).mockResolvedValue({
        id: 'job-1',
        status: 'COMPLETED',
        createdAt: new Date(),
        type: 'MANUAL',
        databasePath: '/some/path/database.sql',
        filesPath: '/some/path/uploads.tar.gz',
      } as any);

      vi.mocked(backupRepository.createRestoreJob).mockResolvedValue({ id: 'r-1' } as any);
      vi.mocked(backupService.verifyBackup).mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
      });
      vi.mocked(existsSync).mockReturnValue(true);

      const result = await restoreService.startRestore('job-1', 'admin-1');

      expect(backupService.createBackup).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'PRE_RESTORE' })
      );
      expect(backupService.setBackupLock).toHaveBeenCalledWith(true);
      expect(db.setting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: { key: 'maintenanceMode', value: 'true' } })
      );
      expect(shell.restoreDatabase).toHaveBeenCalled();
      expect(result.status).toBe('COMPLETED');
    });
  });
});
