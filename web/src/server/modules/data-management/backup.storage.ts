/**
 * Data Management — Backup Storage
 *
 * Storage inspection, directory walk sizing with TTL cache, and disk usage queries.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { existsSync } from 'fs';
import { readdir as readdirAsync, stat as statAsync } from 'fs/promises';
import { join } from 'path';
import {
  getFreeDiskBytes as getFreeDiskBytesHelper,
  getDiskUsage,
} from '@/lib/shell';

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

export function getFreeDiskBytes(): number {
  const backupRoot = process.env.BACKUP_ROOT || join(process.cwd(), 'data', 'backups');
  return getFreeDiskBytesHelper(backupRoot);
}

export const DIR_WALK_BUDGET = { maxEntries: 50_000, maxDepth: 16 } as const;
export const dirSizeCache = new Map<string, { size: number; expiresAt: number; truncated: boolean }>();
export const DIR_SIZE_CACHE_TTL_MS = 60 * 1000;

export async function calculateDirSizeCached(dirPath: string): Promise<number> {
  const now = Date.now();
  const hit = dirSizeCache.get(dirPath);
  if (hit && hit.expiresAt > now) return hit.size;

  let size = 0;
  let visited = 0;
  let truncated = false;

  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > DIR_WALK_BUDGET.maxDepth || truncated) return;
    let entries;
    try {
      entries = await readdirAsync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (++visited > DIR_WALK_BUDGET.maxEntries) {
        truncated = true;
        logger.warn('[BackupService] Directory size walk hit entry budget — result is a lower bound', {
          dirPath,
          maxEntries: DIR_WALK_BUDGET.maxEntries,
        });
        return;
      }
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
        if (truncated) return;
      } else if (entry.isFile()) {
        try {
          size += (await statAsync(full)).size;
        } catch {}
      }
    }
  };

  await walk(dirPath, 0);
  dirSizeCache.set(dirPath, { size, expiresAt: now + DIR_SIZE_CACHE_TTL_MS, truncated });
  return size;
}

export async function getStorageOverview() {
  const uploadsRoot = await getUploadsRootAsync();
  const backupRoot = await getBackupRootAsync();

  let uploadsSize = 0;
  let backupsSize = 0;
  let logsSize = 0;
  let databaseSizeBytes = 0;

  try {
    databaseSizeBytes = await getDatabaseSize();
  } catch {}

  if (existsSync(uploadsRoot)) {
    uploadsSize = await calculateDirSizeCached(uploadsRoot);
  }

  if (existsSync(backupRoot)) {
    backupsSize = await calculateDirSizeCached(backupRoot);
  }

  const logsDir = join(process.cwd(), 'logs');
  if (existsSync(logsDir)) {
    logsSize = await calculateDirSizeCached(logsDir);
  }

  const disk = getDiskUsage(backupRoot);

  return {
    databaseSizeBytes,
    uploadsSizeBytes: uploadsSize,
    backupsSizeBytes: backupsSize,
    logsSizeBytes: logsSize,
    freeDiskBytes: disk.freeBytes,
    totalDiskBytes: disk.totalBytes,
  };
}
