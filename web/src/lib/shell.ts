/**
 * Cross-platform Safe Shell Utilities
 *
 * Replaces raw execSync shell strings with execFileSync argument arrays
 * for injection safety and cross-platform compatibility.
 *
 * All database commands use argument arrays (no shell string interpolation).
 * All archive commands use native tools:
 *   - Windows: PowerShell Compress-Archive / Expand-Archive
 *   - Unix:    tar
 */

import { execFileSync, execSync } from 'child_process';
import { platform } from 'os';
import { logger } from '@/lib/logger';

const IS_WIN = platform() === 'win32';

// ─── Archive Helpers ────────────────────────────────────────────────────

/**
 * Create a compressed archive of a directory.
 * On Windows uses PowerShell Compress-Archive; on Unix uses tar.
 */
export function createArchive(sourceDir: string, outputFile: string): void {
  if (IS_WIN) {
    // PowerShell: Compress-Archive -Path sourceDir\* -DestinationPath outputFile -CompressionLevel Optimal
    const psScript = [
      'powershell.exe',
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path "${sourceDir}\\*" -DestinationPath "${outputFile}" -CompressionLevel Optimal -Force`,
    ];
    execFileSync(psScript[0], psScript.slice(1), {
      timeout: 300_000,
      stdio: 'pipe',
    });
  } else {
    execFileSync('tar', ['-czf', outputFile, '-C', sourceDir, '.'], {
      timeout: 300_000,
      stdio: 'pipe',
    });
  }
}

/**
 * Extract a compressed archive into a directory.
 * On Windows uses PowerShell Expand-Archive; on Unix uses tar.
 */
export function extractArchive(archiveFile: string, outputDir: string): void {
  if (IS_WIN) {
    const psScript = [
      'powershell.exe',
      '-NoProfile',
      '-Command',
      `Expand-Archive -Path "${archiveFile}" -DestinationPath "${outputDir}" -Force`,
    ];
    execFileSync(psScript[0], psScript.slice(1), {
      timeout: 300_000,
      stdio: 'pipe',
    });
  } else {
    execFileSync('tar', ['-xzf', archiveFile, '-C', outputDir], {
      timeout: 300_000,
      stdio: 'pipe',
    });
  }
}

// ─── Database Helpers ───────────────────────────────────────────────────

/**
 * Dump a PostgreSQL database using pg_dump with argument array (no shell).
 * Connection string is passed via --dbname to avoid shell interpolation.
 */
export function dumpDatabase(dbUrl: string, outputFile: string): void {
  execFileSync(
    'pg_dump',
    [
      `--dbname=${dbUrl}`,
      '-f', outputFile,
      '--no-owner',
      '--no-acl',
    ],
    { timeout: 300_000, stdio: 'pipe' }
  );
}

/**
 * Restore a PostgreSQL database using psql with argument array (no shell).
 * Uses -f to read from file instead of shell redirect (<).
 */
export function restoreDatabase(dbUrl: string, inputFile: string): void {
  execFileSync(
    'psql',
    [
      `--dbname=${dbUrl}`,
      '-f', inputFile,
    ],
    { timeout: 600_000, stdio: 'pipe' }
  );
}

// ─── Disk Space Helpers ─────────────────────────────────────────────────

/**
 * Get available free disk space in bytes on a given path/drive.
 */
export function getFreeDiskBytes(path: string): number {
  if (!path) return 0;

  try {
    if (IS_WIN) {
      const drive = path.split(':')[0] || 'D';
      // Use PowerShell Get-PSDrive for safer access
      const psScript = [
        'powershell.exe',
        '-NoProfile',
        '-Command',
        `(Get-PSDrive -Name ${drive}).Free`,
      ];
      const result = execFileSync(psScript[0], psScript.slice(1), {
        timeout: 10_000,
        encoding: 'utf-8',
      });
      const free = parseInt(result.trim(), 10);
      return isNaN(free) ? 0 : free;
    } else {
      const result = execFileSync('df', ['-k', '--output=avail', path], {
        timeout: 10_000,
        encoding: 'utf-8',
      });
      const lines = result.trim().split('\n');
      if (lines.length >= 2) {
        const kb = parseInt(lines[1].trim(), 10);
        return isNaN(kb) ? 0 : kb * 1024;
      }
      return 0;
    }
  } catch {
    return 0;
  }
}

/**
 * Get total and free disk space in bytes.
 */
export function getDiskUsage(path: string): { freeBytes: number; totalBytes: number } {
  if (!path) return { freeBytes: 0, totalBytes: 0 };

  try {
    if (IS_WIN) {
      const drive = path.split(':')[0] || 'D';
      const psScript = [
        'powershell.exe',
        '-NoProfile',
        '-Command',
        `$d=Get-PSDrive -Name ${drive}; Write-Output "$($d.Used) $($d.Free)"`,
      ];
      const result = execFileSync(psScript[0], psScript.slice(1), {
        timeout: 10_000,
        encoding: 'utf-8',
      });
      const parts = result.trim().split(' ');
      const freeBytes = parseInt(parts[1] || '0', 10);
      const usedBytes = parseInt(parts[0] || '0', 10);
      return {
        freeBytes: isNaN(freeBytes) ? 0 : freeBytes,
        totalBytes: isNaN(freeBytes + usedBytes) ? 0 : freeBytes + usedBytes,
      };
    } else {
      const result = execFileSync('df', ['-k', '--output=avail,size', path], {
        timeout: 10_000,
        encoding: 'utf-8',
      });
      const lines = result.trim().split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].trim().split(/\s+/);
        const freeKb = parseInt(parts[0], 10);
        const totalKb = parseInt(parts[1], 10);
        return {
          freeBytes: isNaN(freeKb) ? 0 : freeKb * 1024,
          totalBytes: isNaN(totalKb) ? 0 : totalKb * 1024,
        };
      }
      return { freeBytes: 0, totalBytes: 0 };
    }
  } catch {
    return { freeBytes: 0, totalBytes: 0 };
  }
}

// ─── Prisma Migrate Helper ──────────────────────────────────────────────

/**
 * Run prisma migrate deploy in a given working directory.
 */
export function runMigrations(cwd: string): void {
  if (IS_WIN) {
    // npx on Windows needs shell for .cmd resolution
    execSync('npx prisma migrate deploy', {
      timeout: 120_000,
      stdio: 'pipe',
      cwd,
    });
  } else {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      timeout: 120_000,
      stdio: 'pipe',
      cwd,
    });
  }
}
