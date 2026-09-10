/**
 * Disk-usage cache (P1-1).
 *
 * `getDiskUsage()` runs `execFileSync('powershell', ...)` (or `df` on
 * POSIX) on every `/api/health` request — including the public,
 * unauthenticated load-balancer poll. Under PM2 cluster that pins
 * one worker per poll and is a cheap-DoS amplifier.
 *
 * Wrap the call in a 60s process-wide cache. First call after a cold
 * start pays the subprocess cost; the next 60s serve from memory.
 * PM2 cluster workers each have their own cache, which is fine.
 *
 * `clearDiskCacheForTests()` is exported so vitest can reset the
 * module between cases.
 */

import { execFileSync } from 'child_process';
import { parse } from 'path';
import os from 'os';

export interface DiskUsage {
  totalMB: number;
  freeMB: number;
  usedMB: number;
  usagePercent: number;
  source: string;
}

const DISK_TTL_MS = 60_000;

let cached: { value: DiskUsage; expiresAt: number } | null = null;

function getProbePath(): string {
  return process.env.LOCAL_STORAGE_ROOT || process.env.VOLTIUM_SERVER_ROOT || process.cwd();
}

/**
 * Raw disk usage probe — synchronous subprocess call. Do not call
 * directly; use `getDiskUsageCached()` instead.
 */
export function getDiskUsageRaw(): DiskUsage {
  const probePath = getProbePath();

  // Windows: use PowerShell/CIM for the drive containing the probe path.
  if (process.platform === 'win32') {
    try {
      const root = parse(probePath).root.replace(/\\$/, ''); // e.g. D:
      const deviceId = root.slice(0, 2); // e.g. D:
      const script = `$d = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${deviceId}'"; if ($d) { [Console]::WriteLine(($d.Size).ToString() + ',' + ($d.FreeSpace).ToString()) }`;
      const output = execFileSync('powershell', ['-NoProfile', '-Command', script], {
        encoding: 'utf8',
      }).trim();
      const [totalBytesRaw, freeBytesRaw] = output.split(',');
      const totalBytes = Number(totalBytesRaw || 0);
      const freeBytes = Number(freeBytesRaw || 0);
      if (totalBytes > 0) {
        const usedBytes = totalBytes - freeBytes;
        return {
          totalMB: Math.round(totalBytes / 1024 / 1024),
          freeMB: Math.round(freeBytes / 1024 / 1024),
          usedMB: Math.round(usedBytes / 1024 / 1024),
          usagePercent: Math.round((usedBytes / totalBytes) * 100),
          source: deviceId,
        };
      }
    } catch {
      // fall through to POSIX df fallback
    }
  }

  // POSIX fallback.
  try {
    const output = execFileSync('df', ['-m', probePath], { encoding: 'utf8' });
    const lines = output.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      const totalMB = parseInt(parts[1], 10);
      const usedMB = parseInt(parts[2], 10);
      const freeMB = parseInt(parts[3], 10);
      const usagePercent = totalMB > 0 ? Math.round((usedMB / totalMB) * 100) : 0;
      return { totalMB, freeMB, usedMB, usagePercent, source: probePath };
    }
  } catch {
    // no disk metrics available
  }

  return { totalMB: 0, freeMB: 0, usedMB: 0, usagePercent: 0, source: probePath };
}

/**
 * Cached disk usage. First call probes; subsequent calls within
 * `DISK_TTL_MS` (60s) return the cached value.
 */
export function getDiskUsageCached(): DiskUsage {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const v = getDiskUsageRaw();
  cached = { value: v, expiresAt: Date.now() + DISK_TTL_MS };
  return v;
}

/**
 * Test-only: clear the module-level cache so the next call
 * re-probes. Exported for vitest; do not call from production code.
 */
export function clearDiskCacheForTests(): void {
  cached = null;
}

// Keep the os import referenced so tree-shakers don't drop the
// type-only re-export when consumers import just the cache.
void os;
