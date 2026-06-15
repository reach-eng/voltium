/**
 * Data Management — Backup Service
 *
 * Orchestrates backup creation, verification, and scheduling.
 * All file operations use local disk paths — no cloud storage.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit-log';
import { backupRepository } from './backup.repository';
import { existsSync, mkdirSync, writeFileSync, statSync, readdirSync, readFileSync, rmSync } from 'fs';

const BACKUP_LOCK_KEY = 'backupLock';
const BACKUP_LOCK_VALUE = 'RESTORE_RUNNING';
import { join } from 'path';
import { createHash } from 'crypto';
import { dumpDatabase, createArchive, getFreeDiskBytes as getFreeDiskBytesHelper, getDiskUsage } from '@/lib/shell';

function getBackupRoot(): string {
  return process.env.BACKUP_ROOT || join(process.cwd(), 'data', 'backups');
}

function getSecondaryRoot(): string | null {
  return process.env.BACKUP_SECONDARY_ROOT || null;
}

function getUploadsRoot(): string {
  return process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads');
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
    totalDeleted += await backupService.purgeOldBackupsByType('DAILY', dailyCutoff, policy.keepDaily);

    // Weekly backups: keep N most recent
    const weeklyCutoff = new Date(now);
    weeklyCutoff.setDate(weeklyCutoff.getDate() - policy.keepWeekly * 14);
    totalDeleted += await backupService.purgeOldBackupsByType('WEEKLY', weeklyCutoff, policy.keepWeekly);

    // Monthly backups: keep N most recent
    const monthlyCutoff = new Date(now);
    monthlyCutoff.setMonth(monthlyCutoff.getMonth() - 12);
    totalDeleted += await backupService.purgeOldBackupsByType('MONTHLY', monthlyCutoff, policy.keepMonthly);

    // Manual backups: if keepManual is set, keep only the most recent N
    if (policy.keepManual !== null) {
      totalDeleted += await backupService.purgeOldBackupsByType('MANUAL', new Date(0), policy.keepManual);
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

    const secondaryRoot = getSecondaryRoot();
    const primaryRoot = getBackupRoot();
    let purgedCount = 0;

    for (const job of oldJobs) {
      try {
        // 1. Delete primary backup folder
        if (job.backupPath && existsSync(job.backupPath)) {
          rmSync(job.backupPath, { recursive: true, force: true });
        }

        // 2. Delete secondary backup folder if configured
        if (secondaryRoot && job.backupPath) {
          const relativePath = job.backupPath.replace(primaryRoot, '');
          const secondaryPath = join(secondaryRoot, relativePath);
          if (existsSync(secondaryPath)) {
            rmSync(secondaryPath, { recursive: true, force: true });
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
          error: err instanceof Error ? err.message : 'Unknown error',
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
      throw new Error(`Insufficient disk space: ${freeGb.toFixed(1)} GB free, need ${minimumFreeDiskGb} GB`);
    }

    // Override backup root for this backup
    const originalRoot = process.env.BACKUP_ROOT;
    process.env.BACKUP_ROOT = schedule.primaryBackupRoot;
    if (schedule.secondaryBackupRoot) {
      process.env.BACKUP_SECONDARY_ROOT = schedule.secondaryBackupRoot;
    }

    try {
      const result = await backupService.createBackup({
        type: 'SCHEDULED',
        scheduleType: schedule.frequency,
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
    } finally {
      process.env.BACKUP_ROOT = originalRoot;
    }
  },

  async createBackup(params: {
    type: 'MANUAL' | 'SCHEDULED' | 'PRE_RESTORE';
    scheduleType?: string;
    adminId?: string;
    notes?: string;
  }) {
    const backupId = `backup_${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}`;
    const backupDir = join(getBackupRoot(), params.type.toLowerCase(), backupId);

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
      const uploadsFile = join(backupDir, 'uploads.tar.gz');
      const manifestFile = join(backupDir, 'manifest.json');
      const checksumFile = join(backupDir, 'checksums.sha256');

      // 1. Database dump via pg_dump (safe arg array, no shell)
      const dbUrl = process.env.DATABASE_URL || '';
      logger.info('[BackupService] Starting database dump', { backupId });

      try {
        dumpDatabase(dbUrl, databaseFile);
      } catch (dbErr: any) {
        throw new Error(`Database dump failed: ${dbErr.message}`);
      }

      // 2. Archive uploaded files (cross-platform: tar on Unix, PowerShell on Windows)
      logger.info('[BackupService] Archiving uploads', { backupId });
      try {
        createArchive(getUploadsRoot(), uploadsFile);
      } catch (fileErr: any) {
        throw new Error(`Uploads archive failed: ${fileErr.message}`);
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
        status: 'COMPLETED',
        createdBy: params.adminId || 'SYSTEM',
      };
      writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));

      // 4. Generate checksums
      const dbHash = createHash('sha256').update(readFileSync(databaseFile)).digest('hex');
      const uploadsHash = createHash('sha256').update(readFileSync(uploadsFile)).digest('hex');

      const checksumLines = [
        `${dbHash}  database.sql`,
        `${uploadsHash}  uploads.tar.gz`,
      ];
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
      const secondaryRoot = getSecondaryRoot();
      if (secondaryRoot) {
        try {
          const secondaryDir = join(secondaryRoot, params.type.toLowerCase(), backupId);
          mkdirSync(secondaryDir, { recursive: true });
          // Use fs.cp for cross-platform directory copy (Node 16.7+)
          const { cpSync } = await import('fs');
          cpSync(backupDir, secondaryDir, { recursive: true, force: true });
          logger.info('[BackupService] Copied backup to secondary location', { secondaryDir });
        } catch (copyErr: any) {
          logger.warn('[BackupService] Secondary backup copy failed', { error: copyErr.message });
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

      return { id: job.id, backupId, status: 'COMPLETED', path: backupDir, sizeBytes: Number(totalSize) };
    } catch (err: any) {
      // Mark job as failed
      await backupRepository.updateBackupJob(job.id, {
        status: 'FAILED',
        errorMessage: err.message,
        completedAt: new Date(),
      });

      await createAuditLog({
        actorId: params.adminId || 'SYSTEM',
        actorType: params.adminId ? 'ADMIN' : 'SYSTEM',
        action: 'backup.failed',
        entity: 'BackupJob',
        entityId: job.id,
        details: { backupId, error: err.message },
      });

      logger.error('[BackupService] Backup failed', { backupId, error: err.message });
      throw err;
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
    if (job.backupPath && existsSync(job.backupPath)) {
      rmSync(job.backupPath, { recursive: true, force: true });
    }

    // Delete from secondary location if exists
    const secondaryRoot = getSecondaryRoot();
    if (secondaryRoot && job.backupPath) {
      const relativePath = job.backupPath.replace(getBackupRoot(), '');
      const secondaryPath = join(secondaryRoot, relativePath);
      if (existsSync(secondaryPath)) {
        rmSync(secondaryPath, { recursive: true, force: true });
      }
    }

    await backupRepository.deleteBackupJob(backupJobId);
  },

  /**
   * Set or release the backup lock.
   * When set to RESTORE_RUNNING, scheduled backups will skip execution.
   */
  async setBackupLock(locked: boolean): Promise<void> {
    if (locked) {
      await db.setting.upsert({
        where: { key: BACKUP_LOCK_KEY },
        update: { value: BACKUP_LOCK_VALUE },
        create: { key: BACKUP_LOCK_KEY, value: BACKUP_LOCK_VALUE },
      });
      logger.info('[BackupService] Backup lock acquired — scheduled backups paused');
    } else {
      await db.setting.deleteMany({ where: { key: BACKUP_LOCK_KEY } });
      logger.info('[BackupService] Backup lock released — scheduled backups resumed');
    }
  },

  /**
   * Check if the backup lock is currently set.
   */
  async isBackupLocked(): Promise<boolean> {
    try {
      const lock = await db.setting.findUnique({ where: { key: BACKUP_LOCK_KEY } });
      return lock?.value === BACKUP_LOCK_VALUE;
    } catch {
      return false;
    }
  },

  async getStorageOverview() {
    const uploadsRoot = getUploadsRoot();
    const backupRoot = getBackupRoot();

    let uploadsSize = 0;
    let backupsSize = 0;
    let logsSize = 0;

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
      databaseSizeBytes: 0,
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
  next.setHours(hours || 2, minutes || 0, 0, 0);

  // If today's time has passed, move to next occurrence
  if (next <= now) {
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
      case 'MONTHLY': {
        const targetDay = Math.min(config.dayOfMonth ?? 1, 28);
        next.setDate(targetDay);
        if (next <= now) {
          next.setMonth(next.getMonth() + 1);
          next.setDate(targetDay);
        }
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
  const backupRoot = process.env.BACKUP_ROOT || '';
  if (!backupRoot) return 0;
  return getFreeDiskBytesHelper(backupRoot);
}
