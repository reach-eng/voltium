import { existsSync, mkdirSync, writeFileSync, statSync, rmSync } from 'fs';
import { join } from 'path';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit-log';
import { backupRepository } from './backup.repository';
import { dumpDatabase, createArchive } from '@/lib/shell';
import { env } from '@/lib/env';
import { encryptFile } from './backup-encryption.service';
import { calculateDirSize, extractDbName, generateChecksums, verifyBackup } from './backup-validation.service';
import { getBackupRootAsync, getUploadsRootAsync, getDatabaseSize, copyToSecondary } from '../storage/storage.service';
import { getFreeDiskBytes as getFreeDiskBytesHelper } from '@/lib/shell';
import { ValidationError, NotFoundError } from "@/lib/api-error";
import { backupLockService } from './backup-lock.service';

export const backupService = {
  async createBackup(params: {
    type: 'MANUAL' | 'SCHEDULED' | 'PRE_RESTORE';
    scheduleType?: string;
    adminId?: string;
    notes?: string;
  }) {
    const backupId = `backup_${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
    const backupRoot = await getBackupRootAsync();
    const backupDir = join(backupRoot, params.type.toLowerCase(), backupId);

    const uploadsRoot = await getUploadsRootAsync();
    const uploadsSizeVal = existsSync(uploadsRoot) ? calculateDirSize(uploadsRoot) : 0;
    const dbSizeVal = await getDatabaseSize();
    const estimatedBackupSize = dbSizeVal + uploadsSizeVal;
    const requiredFreeBytes = Math.max(estimatedBackupSize * 2, 50 * 1024 * 1024);

    const freeBytes = getFreeDiskBytesHelper(backupRoot);
    if (freeBytes < requiredFreeBytes) {
      const freeGb = freeBytes / (1024 * 1024 * 1024);
      const reqGb = requiredFreeBytes / (1024 * 1024 * 1024);
      throw new ValidationError(
        `Insufficient disk space for backup: ${freeGb.toFixed(2)} GB free, need at least ${reqGb.toFixed(2)} GB`
      );
    }

    const isPreRestore = params.type === 'PRE_RESTORE';
    if (!isPreRestore) {
      const acquired = await backupLockService.acquireLock('BACKUP_RUNNING', params.adminId || 'SYSTEM');
      if (!acquired) {
        throw new ValidationError('Another backup or restore operation is currently running');
      }
    }

    const job = await backupRepository.createBackupJob({
      type: params.type,
      scheduleType: params.scheduleType,
      status: 'RUNNING',
      createdByAdminId: params.adminId,
    });

    try {
      mkdirSync(backupDir, { recursive: true });

      const databaseFile = join(backupDir, 'database.sql');
      const uploadsFile = join(backupDir, 'uploads.zip');
      const manifestFile = join(backupDir, 'manifest.json');
      const checksumFile = join(backupDir, 'checksums.sha256');

      const dbUrl = process.env.DATABASE_URL || '';
      logger.info('[BackupService] Starting database dump', { backupId });

      try {
        dumpDatabase(dbUrl, databaseFile);
      } catch (dbErr: any) {
        throw new ValidationError(`Database dump failed: ${dbErr.message}`);
      }

      logger.info('[BackupService] Archiving uploads', { backupId });
      const uploadsRootForArchive = await getUploadsRootAsync();
      try {
        createArchive(uploadsRootForArchive, uploadsFile);
      } catch (fileErr: any) {
        throw new ValidationError(`Uploads archive failed: ${fileErr.message}`);
      }

      const manifest = {
        backupId,
        type: params.type,
        createdAt: new Date().toISOString(),
        appVersion: process.env.npm_package_version || '1.0.0',
        database: 'postgresql',
        databaseName: extractDbName(dbUrl),
        uploadsIncluded: true,
        encrypted: env.BACKUP_ENCRYPTION_ENABLED && !!env.BACKUP_ENCRYPTION_KEY,
        status: 'COMPLETED',
        createdBy: params.adminId || 'SYSTEM',
      };
      writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

      const encryptionEnabled = env.BACKUP_ENCRYPTION_ENABLED;
      const encryptionKey = env.BACKUP_ENCRYPTION_KEY || process.env.BACKUP_ENCRYPTION_KEY;
      if (encryptionEnabled && encryptionKey) {
        logger.info('[BackupService] Encrypting backup files', { backupId });
        try {
          encryptFile(databaseFile, encryptionKey);
          encryptFile(uploadsFile, encryptionKey);
        } catch (encErr: any) {
          throw new ValidationError(`Backup encryption failed: ${encErr.message}`);
        }
      }

      const checksumContent = generateChecksums([
        { path: databaseFile, name: 'database.sql' },
        { path: uploadsFile, name: 'uploads.zip' },
      ]);
      writeFileSync(checksumFile, checksumContent);

      const dbFileSize = statSync(databaseFile).size;
      const uploadsFileSize = statSync(uploadsFile).size;
      const totalSize = BigInt(dbFileSize + uploadsFileSize);

      await backupRepository.updateBackupJob(job.id, {
        status: 'COMPLETED',
        backupPath: backupDir,
        databasePath: databaseFile,
        filesPath: uploadsFile,
        manifestPath: manifestFile,
        checksumPath: checksumFile,
        sizeBytes: totalSize,
        completedAt: new Date(),
      });

      await copyToSecondary(backupDir, params.type, backupId);

      await createAuditLog({
        actorId: params.adminId || 'SYSTEM',
        actorType: params.adminId ? 'ADMIN' : 'SYSTEM',
        action: 'backup.created',
        entity: 'BackupJob',
        entityId: job.id,
        details: { backupId, type: params.type, sizeBytes: Number(totalSize) },
      });

      logger.info('[BackupService] Backup completed', { backupId, sizeBytes: Number(totalSize) });

      return {
        id: job.id,
        backupId,
        status: 'COMPLETED',
        path: backupDir,
        sizeBytes: Number(totalSize),
      };
    } catch (err: unknown) {
      await backupRepository.updateBackupJob(job.id, {
        status: 'FAILED',
        errorMessage: (err instanceof Error ? err.message : String(err)),
        completedAt: new Date(),
      });

      await createAuditLog({
        actorId: params.adminId || 'SYSTEM',
        actorType: params.adminId ? 'ADMIN' : 'SYSTEM',
        action: 'backup.failed',
        entity: 'BackupJob',
        entityId: job.id,
        details: { backupId, error: (err instanceof Error ? err.message : String(err)) },
      });

      logger.error('[BackupService] Backup failed', { backupId, error: (err instanceof Error ? err.message : String(err)) });
      throw err;
    } finally {
      if (!isPreRestore) {
        await backupLockService.releaseLock();
      }
    }
  },

  verifyBackup,

  async deleteBackup(backupJobId: string) {
    const job = await backupRepository.getBackupJob(backupJobId);
    if (!job) throw new NotFoundError('Backup job not found');

    if (job.backupPath && existsSync(job.backupPath)) {
      rmSync(job.backupPath, { recursive: true, force: true });
    }

    const { getSecondaryRootAsync } = await import('../storage/storage.service');
    const secondaryRoot = await getSecondaryRootAsync();
    const primaryRoot = await getBackupRootAsync();
    if (secondaryRoot && job.backupPath) {
      const relativePath = job.backupPath.replace(primaryRoot, '');
      const secondaryPath = join(secondaryRoot, relativePath);
      if (existsSync(secondaryPath)) {
        rmSync(secondaryPath, { recursive: true, force: true });
      }
    }

    await backupRepository.deleteBackupJob(backupJobId);
  }
};
