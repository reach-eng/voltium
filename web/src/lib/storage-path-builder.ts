/**
 * StoragePathBuilder — single source of truth for all upload/backup path resolution.
 *
 * Every file-related operation (upload, backup, restore, health check) needs to
 * resolve LOCAL_STORAGE_ROOT, BACKUP_ROOT, and BACKUP_SECONDARY_ROOT.
 *
 * Previously, each file independently replicated the triple-fallback pattern
 * (DB SystemSetting → env var → join(cwd, 'data', 'uploads')). That made it
 * impossible to change path resolution logic without hunting down 12+ sites.
 *
 * Rules:
 *  - Always use getUploadsRoot() / getBackupRoot() instead of inline logic.
 *  - If you need to construct a sub-path, use join() on the result.
 *  - To generate a relative storage key for a new upload, use generateStorageKey().
 */

import { join } from 'path';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

let _cachedUploadsRoot: string | null = null;
let _cachedBackupRoot: string | null = null;

function defaultUploadsRoot(): string {
  return join(process.cwd(), 'data', 'uploads');
}

function defaultBackupRoot(): string {
  return join(process.cwd(), 'data', 'backups');
}

export const StoragePathBuilder = {
  /**
   * Resolve the uploads root directory.
   * Priority: DB SystemSetting → env var → join(cwd, 'data', 'uploads')
   */
  async getUploadsRoot(): Promise<string> {
    if (_cachedUploadsRoot) return _cachedUploadsRoot;
    try {
      const { db } = await import('@/lib/db');
      const setting = await db.systemSetting.findUnique({
        where: { key: 'LOCAL_STORAGE_ROOT' },
      });
      if (setting?.value) {
        _cachedUploadsRoot = setting.value;
        return setting.value;
      }
    } catch {
      // DB not available — fall through to env var
    }
    const resolved = env.LOCAL_STORAGE_ROOT || defaultUploadsRoot();
    _cachedUploadsRoot = resolved;
    return resolved;
  },

  /**
   * Synchronous version for use outside async context.
   * Does NOT check DB — env var or fallback only.
   */
  getUploadsRootSync(): string {
    return env.LOCAL_STORAGE_ROOT || defaultUploadsRoot();
  },

  /**
   * Resolve the backup root directory.
   * Priority: DB SystemSetting → env var → join(cwd, 'data', 'backups')
   */
  async getBackupRoot(): Promise<string> {
    if (_cachedBackupRoot) return _cachedBackupRoot;
    try {
      const { db } = await import('@/lib/db');
      const setting = await db.systemSetting.findUnique({
        where: { key: 'BACKUP_ROOT' },
      });
      if (setting?.value) {
        _cachedBackupRoot = setting.value;
        return setting.value;
      }
    } catch {
      // DB not available — fall through to env var
    }
    const resolved = env.BACKUP_ROOT || defaultBackupRoot();
    _cachedBackupRoot = resolved;
    return resolved;
  },

  getBackupRootSync(): string {
    return env.BACKUP_ROOT || defaultBackupRoot();
  },

  /**
   * Resolve the secondary backup root directory.
   */
  async getSecondaryRoot(): Promise<string | null> {
    try {
      const { db } = await import('@/lib/db');
      const setting = await db.systemSetting.findUnique({
        where: { key: 'BACKUP_SECONDARY_ROOT' },
      });
      if (setting?.value) return setting.value;
    } catch {
      // DB not available
    }
    return env.BACKUP_SECONDARY_ROOT || null;
  },

  /**
   * Generate a relative storage key for an uploaded file.
   * This is the RELATIVE path (no base directory) — concatenate with getUploadsRoot().
   *
   * Pattern: {ownerId}/{category}/{timestamp}-{safeName}
   */
  generateStorageKey(
    ownerId: string,
    category: string,
    fileName: string,
    timestamp?: number
  ): string {
    const ts = timestamp ?? Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${ownerId}/${category}/${ts}-${safeName}`;
  },

  /**
   * Construct a FULL absolute path for a storage key.
   * Includes path traversal protection.
   */
  async resolveFullPath(storageKey: string): Promise<string> {
    const baseDir = await this.getUploadsRoot();
    return this.resolveAbsolute(baseDir, storageKey);
  },

  /**
   * Validate that a resolved path does not escape the base directory (path traversal protection).
   */
  resolveAbsolute(baseDir: string, relativePath: string): string {
    const { resolve, sep } = require('path') as typeof import('path');
    const resolved = resolve(join(baseDir, relativePath));
    if (!resolved.startsWith(resolve(baseDir) + sep) && resolved !== resolve(baseDir)) {
      throw new Error(`Path traversal detected: ${relativePath} resolves outside ${baseDir}`);
    }
    return resolved;
  },

  /**
   * Invalidate caches — call after env vars or DB settings change at runtime.
   */
  invalidateCache(): void {
    _cachedUploadsRoot = null;
    _cachedBackupRoot = null;
    logger.debug('[StoragePathBuilder] Cache invalidated');
  },
};
