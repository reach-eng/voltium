/**
 * Backup — Upload & Storage Service
 *
 * Path resolution (primary / secondary / uploads roots), disk space checks,
 * database size estimation, and secondary-location copy.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getFreeDiskBytes as getFreeDiskBytesHelper, getDiskUsage } from '@/lib/shell';

export function getBackupRoot(): string {
  return process.env.BACKUP_ROOT || join(process.cwd(), 'data', 'backups');
}

export async function getBackupRootAsync(): Promise<string> {
  try {
    const setting = await db.systemSetting.findUnique({ where: { key: 'BACKUP_ROOT' } });
    return setting?.value || process.env.BACKUP_ROOT || join(process.cwd(), 'data', 'backups');
  } catch {
    return process.env.BACKUP_ROOT || join(process.cwd(), 'data', 'backups');
  }
}

export function getSecondaryRoot(): string | null {
  return process.env.BACKUP_SECONDARY_ROOT || null;
}

export async function getSecondaryRootAsync(): Promise<string | null> {
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
export function getUploadsRoot(): string {
  return process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads');
}

export async function getUploadsRootAsync(): Promise<string> {
  try {
    const setting = await db.systemSetting.findUnique({ where: { key: 'LOCAL_STORAGE_ROOT' } });
    return (
      setting?.value || process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads')
    );
  } catch {
    return process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads');
  }
}

export async function getDatabaseSize(): Promise<number> {
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

/**
 * Get free disk space on the backup drive (cross-platform).
 * Uses safe execFile (no shell strings) with PowerShell on Windows, df on Unix.
 */
export function getFreeDiskBytes(): number {
  const backupRoot = process.env.BACKUP_ROOT || join(process.cwd(), 'data', 'backups');
  return getFreeDiskBytesHelper(backupRoot);
}

/**
 * Copy a backup directory to the secondary location if configured.
 */
export async function copyToSecondary(
  backupDir: string,
  type: string,
  backupId: string
): Promise<void> {
  const secondaryRoot = await getSecondaryRootAsync();
  if (!secondaryRoot) return;

  try {
    const secondaryDir = join(secondaryRoot, type.toLowerCase(), backupId);
    mkdirSync(secondaryDir, { recursive: true });
    const { cpSync } = await import('fs');
    cpSync(backupDir, secondaryDir, { recursive: true, force: true });
    logger.info('[BackupService] Copied backup to secondary location', { secondaryDir });
  } catch (copyErr: any) {
    logger.warn('[BackupService] Secondary backup copy failed', { error: copyErr.message });
  }
}

/**
 * Get storage overview: uploads, backups, logs sizes + disk info.
 */
export async function getStorageOverview() {
  const uploadsRoot = await getUploadsRootAsync();
  const backupRoot = await getBackupRootAsync();

  const { calculateDirSize } = await import('../backup/backup-validation.service');

  let uploadsSize = 0;
  let backupsSize = 0;
  let logsSize = 0;

  if (existsSync(uploadsRoot)) {
    uploadsSize = calculateDirSize(uploadsRoot);
  }

  if (existsSync(backupRoot)) {
    backupsSize = calculateDirSize(backupRoot);
  }

  const logsDir = join(process.cwd(), 'logs');
  if (existsSync(logsDir)) {
    logsSize = calculateDirSize(logsDir);
  }

  const disk = getDiskUsage(backupRoot);

  return {
    databaseSizeBytes: 0,
    uploadsSizeBytes: uploadsSize,
    backupsSizeBytes: backupsSize,
    logsSizeBytes: logsSize,
    freeDiskBytes: disk.freeBytes,
    totalDiskBytes: disk.totalBytes,
  };
}
