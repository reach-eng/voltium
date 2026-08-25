/**
 * Data Management — Backup Service
 *
 * Orchestrates backup creation, verification, and scheduling.
 * All file operations use local disk paths — no cloud storage.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit-log';
import { backupRepository } from './backup.repository';
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  statSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'fs';

const BACKUP_LOCK_KEY = 'backupLock';
const BACKUP_LOCK_VALUE = 'RESTORE_RUNNING';
import { join, resolve, sep, isAbsolute } from 'path';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import {
  dumpDatabase,
  createArchive,
  getFreeDiskBytes as getFreeDiskBytesHelper,
  getDiskUsage,
} from '@/lib/shell';
import { env } from '@/lib/env';

/**
 * Encrypt a file in-place using AES-256-GCM. The ciphertext format is:
 *   [12-byte IV][16-byte GCM auth tag][ciphertext...]
 * The original file is replaced with the encrypted version.
 * Returns the new file path (unchanged; content is replaced in-place).
 *
 * Exported for the admin panel Phase 1 AES-256-GCM verification test
 * (tests/unit/admin-panel-phase1-fixes.test.ts). The test exercises
 * the round-trip: encrypt in-place, decrypt to a destination path,
 * assert plaintext recovered. Both helpers stay in this file (not
 * split into a separate module) because they share the IV/tag format
 * contract.
 */
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
  // Write: IV (12) + auth tag (16) + ciphertext
  writeFileSync(filePath, Buffer.concat([iv, authTag, encrypted]));
}

/**
 * Decrypt a file encrypted by `encryptFile`. Reads IV (12) +
 * auth tag (16) + ciphertext from `srcPath`, verifies the
 * GCM tag, and writes the plaintext.
 *
 * Two modes:
 *   - With `destPath`: write plaintext to the destination path
 *     (caller controls where the decrypted file lands).
 *   - Without `destPath` (or `destPath === srcPath`): decrypt
 *     in-place. The original ciphertext is replaced with the
 *     plaintext.
 *
 * Throws on:
 *   - wrong key length (must be 32 bytes / 64 hex chars)
 *   - corrupt header (file < 28 bytes)
 *   - GCM auth tag mismatch (wrong key OR tampered file)
 *
 * Returns the destination path on success.
 */
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

function getBackupRoot(): string {
  return process.env.BACKUP_ROOT || join(process.cwd(), 'data', 'backups');
}

// ── AUDIT FIX (N-3): backup-path containment ────────────────────────────
// Admin-controlled roots (schedule.primaryBackupRoot / BACKUP_ROOT setting)
// used to flow straight into mkdirSync/rmSync — an arbitrary
// write/delete primitive for any settings_manage admin. Every backup path
// must now resolve INSIDE a sanctioned root: the default ./data/backups,
// ./data, or the operator-controlled BACKUP_ROOT / BACKUP_SECONDARY_ROOT
// env vars. Changing disks is an operator (env) decision, not an
// in-app admin decision.
export {
  getAllowedBackupRoots,
  assertBackupPathAllowed,
  safeRmBackupPath,
} from './backup-path.validator';
import {
  getAllowedBackupRoots,
  assertBackupPathAllowed,
  safeRmBackupPath,
} from './backup-path.validator';

async function getBackupRootAsync(): Promise<string> {
  try {
    const setting = await db.systemSetting.findUnique({ where: { key: 'BACKUP_ROOT' } });
    return setting?.value || process.env.BACKUP_ROOT || join(process.cwd(), 'data', 'backups');
  } catch {
    return process.env.BACKUP_ROOT || join(process.cwd(), 'data', 'backups');
  }
}

function getSecondaryRoot(): string | null {
  return process.env.BACKUP_SECONDARY_ROOT || null;
}

async function getSecondaryRootAsync(): Promise<string | null> {
  try {
    const setting = await db.systemSetting.findUnique({ where: { key: 'BACKUP_SECONDARY_ROOT' } });
    return setting?.value || process.env.BACKUP_SECONDARY_ROOT || null;
  } catch {
    return process.env.BACKUP_SECONDARY_ROOT || null;
  }
}

/**
 * Returns the uploads root path, reading from SystemSetting DB first.
 * Falls back to env var, then default path.
 * Note: synchronous callers use the env var path; async callers should
 * await getUploadsRootAsync() if DB-backed config is needed.
 */
function getUploadsRoot(): string {
  return process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads');
}

async function getUploadsRootAsync(): Promise<string> {
  try {
    const setting = await db.systemSetting.findUnique({ where: { key: 'LOCAL_STORAGE_ROOT' } });
    return (
      setting?.value || process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads')
    );
  } catch {
    return process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads');
  }
}

async function getDatabaseSize(): Promise<number> {
  try {
    const result = await db.$queryRaw<{ size: bigint }[]>`
      SELECT pg_database_size(current_database()) as size
    `;
    if (result && result.length > 0) {
      return Number(result[0].size);
    }
  } catch {}
  return 0;
}

export const backupService = {
  // ── Retention Policy ───────────────────────────────────────────────────

  async applyRetentionPolicy(policy: {
    keepDaily: number;
    keepWeekly: number;
    keepMonthly: number;
    keepManual: number | null;
    frequency: string;
  }) {
    const now = new Date();
    let totalDeleted = 0;

    // Daily backups: keep N most recent, delete older
    const dailyCutoff = new Date(now);
    dailyCutoff.setDate(dailyCutoff.getDate() - policy.keepDaily * 2);
    totalDeleted += await backupService.purgeOldBackupsByType(
      'DAILY',
      dailyCutoff,
      policy.keepDaily
    );

    // Weekly backups: keep N most recent
    const weeklyCutoff = new Date(now);
    weeklyCutoff.setDate(weeklyCutoff.getDate() - policy.keepWeekly * 14);
    totalDeleted += await backupService.purgeOldBackupsByType(
      'WEEKLY',
      weeklyCutoff,
      policy.keepWeekly
    );

    // Monthly backups: keep N most recent
    const monthlyCutoff = new Date(now);
    monthlyCutoff.setMonth(monthlyCutoff.getMonth() - 12);
    totalDeleted += await backupService.purgeOldBackupsByType(
      'MONTHLY',
      monthlyCutoff,
      policy.keepMonthly
    );

    // Manual backups: if keepManual is set, keep only the most recent N
    if (policy.keepManual !== null) {
      totalDeleted += await backupService.purgeOldBackupsByType(
        'MANUAL',
        new Date(0),
        policy.keepManual
      );
    }

    if (totalDeleted > 0) {
      logger.info('[BackupService] Retention policy applied', { deletedCount: totalDeleted });
    }

    return totalDeleted;
  },

  /**
   * Find old backups beyond the retention window and purge them completely:
   * 1. Delete the primary backup folder from disk
   * 2. Delete the secondary backup folder from disk (if configured)
   * 3. Delete the BackupJob database row
   * 4. Write audit log
   */
  async purgeOldBackupsByType(type: string, olderThan: Date, keepCount: number): Promise<number> {
    const oldJobs = await db.backupJob.findMany({
      where: { scheduleType: type, createdAt: { lt: olderThan }, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      skip: keepCount,
      select: { id: true, backupPath: true },
    });

    if (oldJobs.length === 0) return 0;

    const secondaryRoot = await getSecondaryRootAsync();
    const primaryRoot = await getBackupRootAsync();
    let purgedCount = 0;

    for (const job of oldJobs) {
      try {
        // 1. Delete primary backup folder
        // AUDIT FIX (N-3): containment-checked delete.
        if (job.backupPath && existsSync(job.backupPath)) {
          safeRmBackupPath(job.backupPath);
        }

        // 2. Delete secondary backup folder if configured
        if (secondaryRoot && job.backupPath) {
          const relativePath = job.backupPath.replace(primaryRoot, '');
          const secondaryPath = join(secondaryRoot, relativePath);
          if (existsSync(secondaryPath)) {
            safeRmBackupPath(secondaryPath);
          }
        }

        // 3. Delete database row
        await backupRepository.deleteBackupJob(job.id);

        // 4. Write audit log
        await createAuditLog({
          actorId: 'SYSTEM',
          actorType: 'SYSTEM',
          action: 'backup.retention_purged',
          entity: 'BackupJob',
          entityId: job.id,
          details: { type, backupPath: job.backupPath },
        });

        purgedCount++;
      } catch (err) {
        logger.error('[BackupService] Failed to purge old backup', {
          jobId: job.id,
          backupPath: job.backupPath,
          error: err instanceof Error ? (err instanceof Error ? err.message : String(err)) : 'Unknown error',
        });
      }
    }

    logger.info('[BackupService] Purged old backups', { type, count: purgedCount });
    return purgedCount;
  },

  // ── Schedule-aware backup creation ─────────────────────────────────────

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
    // Check disk space before starting
    const { minimumFreeDiskGb } = schedule;
    const freeBytes = await getFreeDiskBytes();
    const freeGb = freeBytes / (1024 * 1024 * 1024);
    if (freeGb < minimumFreeDiskGb) {
      throw new Error(
        `Insufficient disk space: ${freeGb.toFixed(1)} GB free, need ${minimumFreeDiskGb} GB`
      );
    }

    // AUDIT FIX (N-3 + N-4): the schedule's admin-controlled roots are
    // (a) contained to sanctioned roots and (b) passed as PARAMETERS
    // through createBackup. The old implementation mutated the
    // process-global `process.env.BACKUP_ROOT` around a long await — any
    // concurrent backup or getBackupRoot() read the wrong root during the
    // window, and overlapping schedules clobbered each other.
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

    // Apply retention policy after successful backup
    await backupService.applyRetentionPolicy({
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
    // AUDIT FIX (N-4): explicit root overrides replace the old
    // process.env mutation. When omitted, the configured defaults apply.
    // Overrides are containment-checked (assertBackupPathAllowed).
    backupRootOverride?: string;
    secondaryRootOverride?: string | null;
  }) {
    const backupId = `backup_${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
    const backupRoot =
      params.backupRootOverride !== undefined
        ? assertBackupPathAllowed(params.backupRootOverride)
        : await getBackupRootAsync();
    const backupDir = join(backupRoot, params.type.toLowerCase(), backupId);

    // Pre-flight check for disk space on the backup drive partition
    const uploadsRoot = await getUploadsRootAsync();
    const uploadsSize = existsSync(uploadsRoot) ? calculateDirSize(uploadsRoot) : 0;
    const dbSize = await getDatabaseSize();
    const estimatedBackupSize = dbSize + uploadsSize;
    // Require at least 2x the estimated size, or a minimum safety buffer of 50MB
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

    // Create backup job record
    const job = await backupRepository.createBackupJob({
      type: params.type,
      scheduleType: params.scheduleType,
      status: 'RUNNING',
      createdByAdminId: params.adminId,
    });

    try {
      // Create backup directory
      mkdirSync(backupDir, { recursive: true });

      const databaseFile = join(backupDir, 'database.sql');
      const uploadsFile = join(backupDir, 'uploads.zip');
      const manifestFile = join(backupDir, 'manifest.json');
      const checksumFile = join(backupDir, 'checksums.sha256');

      // 1. Database dump via pg_dump (safe arg array, no shell)
      const dbUrl = process.env.DATABASE_URL || '';
      logger.info('[BackupService] Starting database dump', { backupId });

      try {
        dumpDatabase(dbUrl, databaseFile);
      } catch (dbErr: unknown) {
        throw new Error(`Database dump failed: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
      }

      // 2. Archive uploaded files (cross-platform: tar on Unix, PowerShell on Windows)
      logger.info('[BackupService] Archiving uploads', { backupId });
      const uploadsRoot = await getUploadsRootAsync();
      try {
        createArchive(uploadsRoot, uploadsFile);
      } catch (fileErr: unknown) {
        throw new Error(`Uploads archive failed: ${fileErr instanceof Error ? fileErr.message : String(fileErr)}`);
      }

      // 3. Create manifest
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

      // 4. Encrypt backup files if configured
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

      // 5. Generate checksums (over the final file content, post-encryption)
      const dbHash = createHash('sha256').update(readFileSync(databaseFile)).digest('hex');
      const uploadsHash = createHash('sha256').update(readFileSync(uploadsFile)).digest('hex');

      const checksumLines = [`${dbHash}  database.sql`, `${uploadsHash}  uploads.zip`];
      writeFileSync(checksumFile, checksumLines.join('\n') + '\n');

      // 5. Calculate size
      const dbSize = statSync(databaseFile).size;
      const uploadsSize = statSync(uploadsFile).size;
      const totalSize = BigInt(dbSize + uploadsSize);

      // 6. Update job record
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

      // 7. Copy to secondary location if configured (cross-platform)
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
          // Use fs.cp for cross-platform directory copy (Node 16.7+)
          const { cpSync } = await import('fs');
          cpSync(backupDir, secondaryDir, { recursive: true, force: true });
          logger.info('[BackupService] Copied backup to secondary location', { secondaryDir });
        } catch (copyErr: unknown) {
          logger.warn('[BackupService] Secondary backup copy failed', { error: copyErr instanceof Error ? copyErr.message : String(copyErr) });
        }
      }

      // 8. Audit log
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
      // Mark job as failed
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

    // Check backup directory exists
    if (!job.backupPath || !existsSync(job.backupPath)) {
      errors.push('Backup directory not found');
    }

    // Check database.sql exists
    if (!job.databasePath || !existsSync(job.databasePath)) {
      errors.push('Database dump file not found');
    }

    // Check uploads archive exists
    if (!job.filesPath || !existsSync(job.filesPath)) {
      warnings.push('Uploads archive not found');
    }

    // Check manifest exists
    if (!job.manifestPath || !existsSync(job.manifestPath)) {
      errors.push('Manifest file not found');
    }

    // Verify checksums if both files exist
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
            const actualHash = createHash('sha256').update(readFileSync(filePath)).digest('hex');
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

    // Delete backup directory
    // AUDIT FIX (N-3): containment-checked delete.
    if (job.backupPath && existsSync(job.backupPath)) {
      safeRmBackupPath(job.backupPath);
    }

    // Delete from secondary location if exists
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
    try {
      return await db.$transaction(async (tx) => {
        const lockStatus = await tx.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_STATUS' } });
        const currentStatus = lockStatus?.value || 'NONE';

        if (currentStatus !== 'NONE') {
          // I-2 (W10): check if the lock has exceeded its 30-minute TTL
          const startedAtSetting = await tx.systemSetting.findUnique({
            where: { key: 'BACKUP_LOCK_STARTED_AT' },
          });
          const startedAt = startedAtSetting?.value ? new Date(startedAtSetting.value).getTime() : 0;
          const LOCK_TTL_MS = 30 * 60 * 1000;
          const isExpired = startedAt > 0 && Date.now() - startedAt > LOCK_TTL_MS;

          if (!isExpired) {
            logger.warn('[BackupService] Failed to acquire lock — lock already held', {
              currentStatus,
              owner,
              startedAt: startedAtSetting?.value,
            });
            return false;
          }

          logger.warn('[BackupService] Overriding expired backup lock (TTL exceeded)', {
            currentStatus,
            heldSince: startedAtSetting?.value,
            ttlMinutes: LOCK_TTL_MS / 60000,
          });
        }

        await Promise.all([
          tx.systemSetting.upsert({
            where: { key: 'BACKUP_LOCK_STATUS' },
            update: { value: status },
            create: { key: 'BACKUP_LOCK_STATUS', value: status, valueType: 'STRING', category: 'INTERNAL', isSecret: false, isEditable: false },
          }),
          tx.systemSetting.upsert({
            where: { key: 'BACKUP_LOCK_STARTED_AT' },
            update: { value: new Date().toISOString() },
            create: { key: 'BACKUP_LOCK_STARTED_AT', value: new Date().toISOString(), valueType: 'STRING', category: 'INTERNAL', isSecret: false, isEditable: false },
          }),
          tx.systemSetting.upsert({
            where: { key: 'BACKUP_LOCK_OWNER' },
            update: { value: owner },
            create: { key: 'BACKUP_LOCK_OWNER', value: owner, valueType: 'STRING', category: 'INTERNAL', isSecret: false, isEditable: false },
          }),
        ]);

        logger.info('[BackupService] Lock acquired successfully', { status, owner });
        return true;
      });
    } catch (err: unknown) {
      logger.error('[BackupService] Error acquiring lock', err);
      return false;
    }
  },

  /**
   * I-2 (W10): Reaps abandoned RUNNING/QUEUED backup jobs older than maxAgeMinutes.
   */
  async reapStaleBackupJobs(maxAgeMinutes = 60): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const staleJobs = await db.backupJob.updateMany({
      where: {
        status: { in: ['RUNNING', 'QUEUED'] },
        createdAt: { lt: cutoff },
      },
      data: {
        status: 'FAILED',
        errorMessage: `Timed out: abandoned in RUNNING/QUEUED state older than ${maxAgeMinutes} minutes`,
      },
    });
    if (staleJobs.count > 0) {
      logger.warn('[BackupService] Reaped stale backup jobs', { count: staleJobs.count });
    }
    return staleJobs.count;
  },

  async releaseLock(): Promise<void> {
    try {
      await Promise.all([
        db.systemSetting.upsert({
          where: { key: 'BACKUP_LOCK_STATUS' },
          update: { value: 'NONE' },
          create: { key: 'BACKUP_LOCK_STATUS', value: 'NONE', valueType: 'STRING', category: 'INTERNAL', isSecret: false, isEditable: false },
        }),
        db.systemSetting.upsert({
          where: { key: 'BACKUP_LOCK_STARTED_AT' },
          update: { value: '' },
          create: { key: 'BACKUP_LOCK_STARTED_AT', value: '', valueType: 'STRING', category: 'INTERNAL', isSecret: false, isEditable: false },
        }),
        db.systemSetting.upsert({
          where: { key: 'BACKUP_LOCK_OWNER' },
          update: { value: '' },
          create: { key: 'BACKUP_LOCK_OWNER', value: '', valueType: 'STRING', category: 'INTERNAL', isSecret: false, isEditable: false },
        }),
      ]);
      logger.info('[BackupService] Lock released successfully');
    } catch (err: unknown) {
      logger.error('[BackupService] Error releasing lock', err);
    }
  },

  async getLockStatus(): Promise<{ status: string; startedAt: string; owner: string }> {
    try {
      const [statusSetting, startedSetting, ownerSetting] = await Promise.all([
        db.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_STATUS' } }),
        db.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_STARTED_AT' } }),
        db.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_OWNER' } }),
      ]);

      return {
        status: statusSetting?.value || 'NONE',
        startedAt: startedSetting?.value || '',
        owner: ownerSetting?.value || '',
      };
    } catch {
      return { status: 'NONE', startedAt: '', owner: '' };
    }
  },

  async setBackupLock(locked: boolean): Promise<void> {
    if (locked) {
      const success = await this.acquireLock('RESTORE_RUNNING', 'RESTORE_SERVICE');
      if (!success) {
        throw new Error('Failed to acquire restore lock — a backup or restore is already running');
      }
    } else {
      await this.releaseLock();
    }
  },

  async isBackupLocked(): Promise<boolean> {
    const lock = await this.getLockStatus();
    return lock.status !== 'NONE';
  },

  async getStorageOverview() {
    const uploadsRoot = await getUploadsRootAsync();
    const backupRoot = await getBackupRootAsync();

    let uploadsSize = 0;
    let backupsSize = 0;
    let logsSize = 0;
    let databaseSizeBytes = 0;

    try {
      databaseSizeBytes = await getDatabaseSize();
    } catch {
      // fallback to 0
    }

    // Calculate uploads size
    if (existsSync(uploadsRoot)) {
      uploadsSize = calculateDirSize(uploadsRoot);
    }

    // Calculate backups size
    if (existsSync(backupRoot)) {
      backupsSize = calculateDirSize(backupRoot);
    }

    // Calculate logs size
    const logsDir = join(process.cwd(), 'logs');
    if (existsSync(logsDir)) {
      logsSize = calculateDirSize(logsDir);
    }

    // Get disk info (cross-platform: PowerShell on Win, df on Unix)
    const disk = getDiskUsage(backupRoot);

    return {
      databaseSizeBytes,
      uploadsSizeBytes: uploadsSize,
      backupsSizeBytes: backupsSize,
      logsSizeBytes: logsSize,
      freeDiskBytes: disk.freeBytes,
      totalDiskBytes: disk.totalBytes,
    };
  },
};

function calculateDirSize(dirPath: string): number {
  let size = 0;
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        size += calculateDirSize(fullPath);
      } else if (entry.isFile()) {
        size += statSync(fullPath).size;
      }
    }
  } catch {}
  return size;
}

function extractDbName(dbUrl: string): string {
  try {
    const url = new URL(dbUrl);
    return url.pathname.replace('/', '') || 'voltium';
  } catch {
    return 'voltium';
  }
}

/**
 * Calculate next backup run time based on schedule configuration.
 */
export function calculateNextRun(config: {
  frequency: string;
  timeOfDay: string;
  timezone?: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
}): Date | null {
  if (!config.frequency || config.frequency === 'MANUAL') return null;

  const now = new Date();
  const [hours, minutes] = config.timeOfDay.split(':').map(Number);

  const next = new Date(now);
  const hoursVal = hours !== undefined && !isNaN(hours) ? hours : 2;
  const minutesVal = minutes !== undefined && !isNaN(minutes) ? minutes : 0;
  next.setHours(hoursVal, minutesVal, 0, 0);

  // MONTHLY always needs day clamping regardless of time
  if (config.frequency === 'MONTHLY') {
    const targetDay = Math.min(config.dayOfMonth ?? 1, 28);
    next.setDate(targetDay);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(targetDay);
    }
  } else if (next <= now) {
    switch (config.frequency) {
      case 'DAILY':
        next.setDate(next.getDate() + 1);
        break;
      case 'WEEKLY': {
        const targetDay = config.dayOfWeek ?? 0;
        const daysUntil = (targetDay - next.getDay() + 7) % 7;
        next.setDate(next.getDate() + (daysUntil || 7));
        break;
      }
    }
  }

  return next;
}

/**
 * Get free disk space on the backup drive (cross-platform).
 * Uses safe execFile (no shell strings) with PowerShell on Windows, df on Unix.
 */
export function getFreeDiskBytes(): number {
  const backupRoot = process.env.BACKUP_ROOT || join(process.cwd(), 'data', 'backups');
  return getFreeDiskBytesHelper(backupRoot);
}
