import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { execFileSync } from 'child_process';
import { existsSync, accessSync, constants } from 'fs';
import { join, parse } from 'path';

const VERSION = process.env.npm_package_version ?? '0.2.0';

function getProbePath(): string {
  return process.env.LOCAL_STORAGE_ROOT || process.env.VOLTIUM_SERVER_ROOT || process.cwd();
}

function getDiskUsage(): { totalMB: number; freeMB: number; usedMB: number; usagePercent: number; source: string } {
  const probePath = getProbePath();

  // Windows: use PowerShell/CIM for the drive containing the probe path.
  if (process.platform === 'win32') {
    try {
      const root = parse(probePath).root.replace(/\\$/, ''); // e.g. D:
      const deviceId = root.slice(0, 2); // e.g. D:
      const script = `$d = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='${deviceId}'"; if ($d) { [Console]::WriteLine(($d.Size).ToString() + ',' + ($d.FreeSpace).ToString()) }`;
      const output = execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' }).trim();
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
      const usagePercent = Math.round((usedMB / totalMB) * 100);
      return { totalMB, freeMB, usedMB, usagePercent, source: probePath };
    }
  } catch {
    // no disk metrics available
  }

  return { totalMB: 0, freeMB: 0, usedMB: 0, usagePercent: 0, source: probePath };
}

function checkWritable(path: string): { exists: boolean; writable: boolean } {
  try {
    const exists = existsSync(path);
    if (!exists) return { exists: false, writable: false };
    accessSync(path, constants.W_OK);
    return { exists: true, writable: true };
  } catch {
    return { exists: existsSync(path), writable: false };
  }
}

async function checkDatabase(): Promise<{
  status: 'healthy' | 'unhealthy';
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch (err: any) {
    logger.error('[Health] Database check failed', { error: err?.message });
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: err?.message ?? 'Unknown error',
    };
  }
}

function checkDisk(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  usagePercent: number;
  freeMB: number;
  totalMB: number;
  usedMB: number;
  source: string;
} {
  const disk = getDiskUsage();
  if (disk.usagePercent === 0) {
    return { status: 'degraded', ...disk };
  }
  if (disk.usagePercent >= 95) {
    return { status: 'unhealthy', ...disk };
  }
  if (disk.usagePercent >= 85) {
    return { status: 'degraded', ...disk };
  }
  return { status: 'healthy', ...disk };
}

export async function GET(request: NextRequest) {
  const detailed = request.nextUrl.searchParams.get('detailed') === 'true';

  const database = await checkDatabase();
  const disk = checkDisk();
  const uptime = process.uptime();

  const uploadsRoot = process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads');
  const backupRoot = process.env.BACKUP_ROOT || join(process.cwd(), 'data', 'backups');
  const uploadPath = checkWritable(uploadsRoot);
  const backupPath = checkWritable(backupRoot);

  const checks = {
    database,
    disk,
    uploadPath: {
      status: uploadPath.exists && uploadPath.writable ? 'healthy' as const : 'degraded' as const,
      path: uploadsRoot,
      exists: uploadPath.exists,
      writable: uploadPath.writable,
    },
    backupPath: {
      status: backupPath.exists && backupPath.writable ? 'healthy' as const : 'degraded' as const,
      path: backupRoot,
      exists: backupPath.exists,
      writable: backupPath.writable,
    },
    uptime: { status: 'healthy' as const, seconds: Math.round(uptime) },
  };

  const anyUnhealthy = Object.values(checks).some((c: any) => c.status === 'unhealthy');
  const anyDegraded = Object.values(checks).some((c: any) => c.status === 'degraded');

  const status = anyUnhealthy ? 'unhealthy' : anyDegraded ? 'degraded' : 'healthy';
  const statusCode = status === 'unhealthy' ? 503 : 200;

  const body: Record<string, unknown> = {
    status,
    checks,
    timestamp: new Date().toISOString(),
    version: VERSION,
    serviceMode: 'local_laptop',
  };

  if (!detailed) {
    body.checks = {
      database: { status: checks.database.status },
      disk: { status: checks.disk.status },
      uploadPath: { status: checks.uploadPath.status },
      backupPath: { status: checks.backupPath.status },
      uptime: { status: checks.uptime.status },
    };
  }

  return NextResponse.json(body, { status: statusCode });
}
