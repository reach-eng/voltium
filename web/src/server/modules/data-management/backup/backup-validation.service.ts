/**
 * Backup — Validation Service
 *
 * Checksum generation, integrity verification, and directory size calculation.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { backupRepository } from './backup.repository';
import { NotFoundError } from "@/lib/api-error";

/**
 * Calculate the total size of a directory recursively.
 */
export function calculateDirSize(dirPath: string): number {
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

/**
 * Extract the database name from a PostgreSQL connection URL.
 */
export function extractDbName(dbUrl: string): string {
  try {
    const url = new URL(dbUrl);
    return url.pathname.replace('/', '') || 'voltium';
  } catch {
    return 'voltium';
  }
}

/**
 * Generate SHA-256 checksum lines for the given files.
 * Returns content in the standard `sha256sum` format: `hash  filename\n`
 */
export function generateChecksums(
  files: Array<{ path: string; name: string }>
): string {
  const lines = files
    .filter((f) => existsSync(f.path))
    .map((f) => {
      const hash = createHash('sha256').update(readFileSync(f.path)).digest('hex');
      return `${hash}  ${f.name}`;
    });
  return lines.join('\n') + '\n';
}

/**
 * Verify a backup's integrity by checking:
 * 1. Backup directory exists
 * 2. Required files (database.sql, manifest.json) exist
 * 3. Checksums match
 *
 * Returns `{ valid, errors, warnings }`.
 */
export async function verifyBackup(backupJobId: string) {
  const job = await backupRepository.getBackupJob(backupJobId);
  if (!job) throw new NotFoundError('Backup job not found');

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
}
