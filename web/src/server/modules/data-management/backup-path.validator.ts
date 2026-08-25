import { resolve, join, isAbsolute, sep } from 'path';
import { rmSync } from 'fs';
import { logger } from '@/lib/logger';

/**
 * Returns list of resolved allowed backup roots.
 * Operator-controlled (via env vars) + canonical local directory.
 */
export function getAllowedBackupRoots(): string[] {
  const roots = new Set<string>([
    resolve(join(process.cwd(), 'data')),
    resolve(join(process.cwd(), 'data', 'backups')),
  ]);
  if (process.env.BACKUP_ROOT) {
    roots.add(resolve(process.env.BACKUP_ROOT));
  }
  if (process.env.BACKUP_SECONDARY_ROOT) {
    roots.add(resolve(process.env.BACKUP_SECONDARY_ROOT));
  }
  return [...roots];
}

/**
 * Resolves `candidate` and asserts it stays under one of the allowed
 * backup roots. Returns the resolved absolute path or throws.
 *
 * Rejects:
 * - Empty strings and null bytes
 * - Relative paths (which would resolve against cwd and could traverse via symlinks)
 * - UNC paths (e.g. \\server\share)
 * - Raw drive roots (e.g. C:\ or /)
 * - Paths that escape allowed backup roots via traversal (..)
 */
export function assertBackupPathAllowed(candidate: string): string {
  if (!candidate || candidate.includes('\0')) {
    throw new Error('Invalid backup path: empty or contains null byte');
  }

  // Reject UNC paths
  if (candidate.startsWith('\\\\') || candidate.startsWith('//')) {
    throw new Error(`Backup path must not be a UNC path: "${candidate}"`);
  }

  // Only absolute paths are accepted for admin-configured roots
  if (!isAbsolute(candidate)) {
    throw new Error(`Backup path must be absolute: "${candidate}"`);
  }

  const resolved = resolve(candidate);

  // Reject raw root paths (e.g. C:\ or / or D:\)
  const isDriveOrFsRoot = resolved === '/' || /^[a-zA-Z]:\\?$/.test(resolved);
  if (isDriveOrFsRoot) {
    throw new Error(`Backup path must not be a filesystem root: "${candidate}"`);
  }

  // Reject Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)
  const pathSegments = resolved.split(/[\\/]/);
  const reservedRegex = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;
  for (const seg of pathSegments) {
    if (reservedRegex.test(seg)) {
      throw new Error(`Backup path contains reserved device name: "${seg}"`);
    }
  }

  // Reject UNIX device nodes
  if (resolved.startsWith('/dev/')) {
    throw new Error(`Backup path must not be a device path: "${candidate}"`);
  }

  const allowed = getAllowedBackupRoots();
  const contained = allowed.some((root) => {
    const normalizedRoot = root.endsWith(sep) ? root.slice(0, -1) : root;
    return resolved === normalizedRoot || resolved.startsWith(normalizedRoot + sep);
  });

  if (!contained) {
    throw new Error(`Backup path "${candidate}" is outside the allowed backup roots`);
  }

  return resolved;
}

/**
 * Defense-in-depth wrapper around rmSync for DB-derived backup paths:
 * refuses to delete anything outside the allowed backup roots.
 * Returns true when the delete was performed.
 */
export function safeRmBackupPath(path: string): boolean {
  try {
    const safePath = assertBackupPathAllowed(path);
    rmSync(safePath, { recursive: true, force: true });
    return true;
  } catch (err) {
    logger.warn('[BackupService] Refusing to delete path outside backup root', {
      path,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
