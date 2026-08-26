/**
 * Data Management — Backup Service
 *
 * Orchestrates backup creation, verification, and scheduling.
 * All file operations use local disk paths — no cloud storage.
 */

import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit-log';
import { backupRepository } from './backup.repository';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  statSync,
  readFileSync,
} from 'fs';
import { join } from 'path';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import {
  dumpDatabase,
  createArchive,
  getFreeDiskBytes as getFreeDiskBytesHelper,
} from '@/lib/shell';
import { env } from '@/lib/env';

// ── Sub-module Imports & Re-exports ─────────────────────────────────────────

export {
  getAllowedBackupRoots,
  assertBackupPathAllowed,
  safeRmBackupPath,
  calculateNextRun,
} from './backup.validation';

export {
  getBackupRoot,
  getBackupRootAsync,
  getSecondaryRoot,
  getSecondaryRootAsync,
  getUploadsRoot,
  getUploadsRootAsync,
  getDatabaseSize,
  getFreeDiskBytes,
  calculateDirSizeCached,
  getStorageOverview,
} from './backup.storage';

export {
  hashFile,
  generateChecksums,
  verifyChecksumFile,
} from './backup.checksum';

export {
  applyRetentionPolicy,
  purgeOldBackupsByType,
} from './backup.retention';

export {
  acquireLock,
  releaseLock,
  getLockStatus,
  setBackupLock,
  isBackupLocked,
  reapStaleBackupJobs,
} from './backup.lock';

import {
  assertBackupPathAllowed,
  safeRmBackupPath,
} from './backup.validation';

import {
  getBackupRootAsync,
  getSecondaryRootAsync,
  getUploadsRootAsync,
  getDatabaseSize,
  getFreeDiskBytes,
  calculateDirSizeCached,
  getStorageOverview,
} from './backup.storage';

import {
  hashFile,
} from './backup.checksum';

import {
  applyRetentionPolicy,
  purgeOldBackupsByType,
} from './backup.retention';

import {
  acquireLock,
  releaseLock,
  getLockStatus,
  setBackupLock,
  isBackupLocked,
  reapStaleBackupJobs,
} from './backup.lock';

export function encryptFile(filePath: string, keyHex: string): void {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('BACKUP_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = readFileSync(filePath);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  writeFileSync(filePath, Buffer.concat([iv, authTag, encrypted]));
}

export function decryptFile(srcPath: string, keyHex: string, destPath?: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) {
    throw new Error('BACKUP_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
  }
  const buf = readFileSync(srcPath);
  if (buf.length < 28) {
    throw new Error(
      `decryptFile: file is too short to contain IV+tag+ciphertext (got ${buf.length} bytes, need >= 28)`
    );
  }
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const out = destPath ?? srcPath;
  writeFileSync(out, plaintext);
  return out;
}

function extractDbName(dbUrl: string): string {
  try {
    const url = new URL(dbUrl);
    return url.pathname.replace('/', '') || 'voltium';
  } catch {
    return 'voltium';
  }
}

export const backupService = {
  async applyRetentionPolicy(policy: {
    keepDaily: number;
    keepWeekly: number;
    keepMonthly: number;
    keepManual: number | null;
    frequency: string;
  }) {
    return applyRetentionPolicy(policy);
  },

  async purgeOldBackupsByType(type: string, olderThan: Date, keepCount: number): Promise<number> {
    return purgeOldBackupsByType(type, olderThan, keepCount);
  },

  async runScheduledBackup(schedule: {
    id: string;
    frequency: string;
    includeDatabase: boolean;
    includeUploads: boolean;
    includeLogs: boolean;
    primaryBackupRoot: string;
    secondaryBackupRoot: string | null;
    keepDaily: number;
    keepWeekly: number;
    keepMonthly: number;
    keepManual: number | null;
    minimumFreeDiskGb: number;
  }) {
    const { minimumFreeDiskGb } = schedule;
    const freeBytes = await getFreeDiskBytes();
    const freeGb = freeBytes / (1024 * 1024 * 1024);
    if (freeGb < minimumFreeDiskGb) {
      throw new Error(
        `Insufficient disk space: ${freeGb.toFixed(1)} GB free, need ${minimumFreeDiskGb} GB`
      );
    }

    const primaryRoot = assertBackupPathAllowed(schedule.primaryBackupRoot);
    const secondaryRoot = schedule.secondaryBackupRoot
      ? assertBackupPathAllowed(schedule.secondaryBackupRoot)
      : null;

    const result = await backupService.createBackup({
      type: 'SCHEDULED',
      scheduleType: schedule.frequency,
      backupRootOverride: primaryRoot,
      secondaryRootOverride: secondaryRoot,
    });

    await applyRetentionPolicy({
      keepDaily: schedule.keepDaily,
      keepWeekly: schedule.keepWeekly,
      keepMonthly: schedule.keepMonthly,
      keepManual: schedule.keepManual,
      frequency: schedule.frequency,
    });

    return result;
  },

  async createBackup(params: {
    type: 'MANUAL' | 'SCHEDULED' | 'PRE_RESTORE';
    scheduleType?: string;
    adminId?: string;
    notes?: string;
    backupRootOverride?: string;
    secondaryRootOverride?: string | null;
  }) {
    const backupId = `backup_${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
    const backupRoot =
      params.backupRootOverride !== undefined
        ? assertBackupPathAllowed(params.backupRootOverride)
        : await getBackupRootAsync();
    const backupDir = join(backupRoot, params.type.toLowerCase(), backupId);

    const uploadsRoot = await getUploadsRootAsync();
    const uploadsSize = existsSync(uploadsRoot) ? await calculateDirSizeCached(uploadsRoot) : 0;
    const dbSize = await getDatabaseSize();
    const estimatedBackupSize = dbSize + uploadsSize;
    const requiredFreeBytes = Math.max(estimatedBackupSize * 2, 50 * 1024 * 1024);

    const freeBytes = getFreeDiskBytesHelper(backupRoot);
    if (freeBytes < requiredFreeBytes) {
      const freeGb = freeBytes / (1024 * 1024 * 1024);
      const reqGb = requiredFreeBytes / (1024 * 1024 * 1024);
      throw new Error(
        `Insufficient disk space for backup: ${freeGb.toFixed(2)} GB free, need at least ${reqGb.toFixed(2)} GB`
      );
    }

    const isPreRestore = params.type === 'PRE_RESTORE';
    if (!isPreRestore) {
      const acquired = await this.acquireLock('BACKUP_RUNNING', params.adminId || 'SYSTEM');
      if (!acquired) {
        throw new Error('Another backup or restore operation is currently running');
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
      } catch (dbErr: unknown) {
        throw new Error(`Database dump failed: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
      }

      logger.info('[BackupService] Archiving uploads', { backupId });
      const uploadsRoot = await getUploadsRootAsync();
      try {
        createArchive(uploadsRoot, uploadsFile);
      } catch (fileErr: unknown) {
        throw new Error(`Uploads archive failed: ${fileErr instanceof Error ? fileErr.message : String(fileErr)}`);
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
        } catch (encErr: unknown) {
          throw new Error(`Backup encryption failed: ${encErr instanceof Error ? encErr.message : String(encErr)}`);
        }
      }

      const dbHash = await hashFile(databaseFile);
      const uploadsHash = await hashFile(uploadsFile);

      const checksumLines = [`${dbHash}  database.sql`, `${uploadsHash}  uploads.zip`];
      writeFileSync(checksumFile, checksumLines.join('\n') + '\n');

      const dbSize = statSync(databaseFile).size;
      const uploadsSize = statSync(uploadsFile).size;
      const totalSize = BigInt(dbSize + uploadsSize);

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

      const secondaryRoot =
        params.secondaryRootOverride !== undefined
          ? params.secondaryRootOverride
            ? assertBackupPathAllowed(params.secondaryRootOverride)
            : null
          : await getSecondaryRootAsync();
      if (secondaryRoot) {
        try {
          const secondaryDir = join(secondaryRoot, params.type.toLowerCase(), backupId);
          mkdirSync(secondaryDir, { recursive: true });
          const { cpSync } = await import('fs');
          cpSync(backupDir, secondaryDir, { recursive: true, force: true });
          logger.info('[BackupService] Copied backup to secondary location', { secondaryDir });
        } catch (copyErr: unknown) {
          logger.warn('[BackupService] Secondary backup copy failed', { error: copyErr instanceof Error ? copyErr.message : String(copyErr) });
        }
      }

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
        await this.releaseLock();
      }
    }
  },

  async verifyBackup(backupJobId: string) {
    const job = await backupRepository.getBackupJob(backupJobId);
    if (!job) throw new Error('Backup job not found');

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!job.backupPath || !existsSync(job.backupPath)) {
      errors.push('Backup directory not found');
    }

    if (!job.databasePath || !existsSync(job.databasePath)) {
      errors.push('Database dump file not found');
    }

    if (!job.filesPath || !existsSync(job.filesPath)) {
      warnings.push('Uploads archive not found');
    }

    if (!job.manifestPath || !existsSync(job.manifestPath)) {
      errors.push('Manifest file not found');
    }

    if (job.databasePath && job.filesPath && job.checksumPath && existsSync(job.checksumPath)) {
      try {
        const checksumContent = readFileSync(job.checksumPath, 'utf-8');
        const lines = checksumContent.trim().split('\n');

        for (const line of lines) {
          const [expectedHash, filename] = line.split(/\s+/);
          if (!expectedHash || !filename) continue;

          if (!job.backupPath) continue;
          const filePath = join(job.backupPath, filename);
          if (existsSync(filePath)) {
            const actualHash = await hashFile(filePath);
            if (actualHash !== expectedHash) {
              errors.push(`Checksum mismatch for ${filename}`);
            }
          }
        }
      } catch {
        warnings.push('Could not verify checksums');
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  },

  async deleteBackup(backupJobId: string) {
    const job = await backupRepository.getBackupJob(backupJobId);
    if (!job) throw new Error('Backup job not found');

    if (job.backupPath && existsSync(job.backupPath)) {
      safeRmBackupPath(job.backupPath);
    }

    const secondaryRoot = await getSecondaryRootAsync();
    const primaryRoot = await getBackupRootAsync();
    if (secondaryRoot && job.backupPath) {
      const relativePath = job.backupPath.replace(primaryRoot, '');
      const secondaryPath = join(secondaryRoot, relativePath);
      if (existsSync(secondaryPath)) {
        safeRmBackupPath(secondaryPath);
      }
    }

    await backupRepository.deleteBackupJob(backupJobId);
  },

  async acquireLock(status: 'BACKUP_RUNNING' | 'RESTORE_RUNNING', owner: string): Promise<boolean> {
    return acquireLock(status, owner);
  },

  async reapStaleBackupJobs(maxAgeMinutes = 60): Promise<number> {
    return reapStaleBackupJobs(maxAgeMinutes);
  },

  async releaseLock(): Promise<void> {
    return releaseLock();
  },

  async getLockStatus(): Promise<{ status: string; startedAt: string; owner: string }> {
    return getLockStatus();
  },

  async setBackupLock(locked: boolean): Promise<void> {
    return setBackupLock(locked);
  },

  async isBackupLocked(): Promise<boolean> {
    return isBackupLocked();
  },

  async getStorageOverview() {
    return getStorageOverview();
  },
};
