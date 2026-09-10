import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { requireAdmin } from '@/lib/rbac';
import { existsSync, accessSync, constants } from 'fs';
import { join } from 'path';
import { readFileSync } from 'fs';
import os from 'os';
import { getDiskUsageCached } from './_diskCache';
import { evaluateOutboxHealth } from '@/lib/outbox-health';

// P2-2: read the version from package.json at module init. The
// previous `process.env.npm_package_version` only fires when launched
// via `npm run`; under PM2 / standalone / CI it is unset, so the
// response permanently reported "0.2.0". An explicit "unknown"
// fallback is honest; the old constant was misleading.
const VERSION: string = (() => {
  try {
    const pkg = JSON.parse(
      readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
    ) as { version?: string };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
})();

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function getProbePath(): string {
  return process.env.LOCAL_STORAGE_ROOT || process.env.VOLTIUM_SERVER_ROOT || process.cwd();
}

// P1-1: getDiskUsage moved to ./_diskCache.ts (cached, 60s TTL).
// Callers use getDiskUsageCached() from that module. The original
// pure probe remains available there as getDiskUsageRaw() for tests.

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
  } catch (err: unknown) {
    const message = errorMessage(err);
    logger.error('[Health] Database check failed', { error: message });
    // P1: generic — raw pg text aids fingerprinting (logged above).
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: 'Database unavailable',
    };
  }
}

function getMemoryUsage(): {
  status: 'healthy';
  freeMB: number;
  totalMB: number;
  usedMB: number;
  usagePercent: number;
} {
  const freeMem = os.freemem();
  const totalMem = os.totalmem();
  const usedMem = totalMem - freeMem;
  const usagePercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;
  return {
    status: 'healthy',
    freeMB: Math.round(freeMem / 1024 / 1024),
    totalMB: Math.round(totalMem / 1024 / 1024),
    usedMB: Math.round(usedMem / 1024 / 1024),
    usagePercent,
  };
}

// P2-3: two-sample CPU delta. The previous cumulative-tick ratio
// measures average busyness since process boot — it converges to a
// flat number and never spikes. We sample (totalTick, totalIdle, at)
// now; if we have a previous sample at least 1s old, we report the
// delta. Otherwise the first call returns 0% (and the card copy
// should say "first sample" — see HardwareMetricsCard).
let lastCpuSample: { totalTick: number; totalIdle: number; at: number } | null = null;

function getCpuUsage(): {
  status: 'healthy';
  usagePercent: number;
  cores: number;
  model: string;
  sampleMs: number;
} {
  const cpus = os.cpus();
  let totalIdle = 0;
  let totalTick = 0;
  if (cpus && cpus.length > 0) {
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += (cpu.times as any)[type];
      }
      totalIdle += cpu.times.idle;
    }
  }
  const now = Date.now();
  let usagePercent = 0;
  let sampleMs = 0;
  if (lastCpuSample && now - lastCpuSample.at >= 1000) {
    const dTick = totalTick - lastCpuSample.totalTick;
    const dIdle = totalIdle - lastCpuSample.totalIdle;
    usagePercent = dTick > 0 ? Math.round((1 - dIdle / dTick) * 100) : 0;
    sampleMs = now - lastCpuSample.at;
  }
  lastCpuSample = { totalTick, totalIdle, at: now };
  return {
    status: 'healthy',
    usagePercent,
    cores: cpus?.length || 1,
    model: cpus[0]?.model || 'Unknown',
    sampleMs,
  };
}

function checkDisk(): {
  status: 'healthy' | 'degraded' | 'unhealthy';
  usagePercent: number;
  freeMB: number;
  totalMB: number;
  usedMB: number;
  source: string;
} {
  // P1-1: cached disk probe (60s TTL). See ./_diskCache.ts.
  const disk = getDiskUsageCached();
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

async function checkOutbox(detailed: boolean) {
  try {
    const [pendingRes, failedRes, oldestRes, stuckRes] = await Promise.all([
      db.$queryRawUnsafe<any[]>('SELECT count(*) FROM outbox_events WHERE status = \'PENDING\''),
      db.$queryRawUnsafe<any[]>('SELECT count(*) FROM outbox_events WHERE status = \'FAILED\''),
      db.$queryRawUnsafe<any[]>('SELECT EXTRACT(EPOCH FROM (now() - "createdAt")) as age_seconds FROM outbox_events WHERE status = \'PENDING\' ORDER BY "createdAt" ASC LIMIT 1'),
      db.$queryRawUnsafe<any[]>('SELECT count(*) FROM outbox_events WHERE status = \'PROCESSING\' AND "updatedAt" < NOW() - INTERVAL \'5 minutes\''),
    ]);
    const queueDepth = Number(pendingRes?.[0]?.count ?? 0);
    const failedCount = Number(failedRes?.[0]?.count ?? 0);
    const oldestPendingAgeSeconds = Number(oldestRes?.[0]?.age_seconds ?? 0);
    const stuckCount = Number(stuckRes?.[0]?.count ?? 0);

    // P1-4: shared threshold table — see @/lib/outbox-health.
    const status = evaluateOutboxHealth({
      pending: queueDepth,
      failed: failedCount,
      stuck: stuckCount,
      oldestPendingAgeSeconds,
    });

    if (detailed) {
      return {
        status,
        queueDepth,
        failedCount,
        stuckCount,
        oldestPendingAgeSeconds,
      };
    }
    return {
      status,
      queueDepth,
    };
  } catch (err) {
    return {
      status: 'unhealthy' as const,
      error: errorMessage(err),
    };
  }
}

export async function GET(request: NextRequest) {
  const wantsDetailed = request.nextUrl.searchParams.get('detailed') === 'true';
  // P1: detailed mode exposes CPU model, disk source, absolute paths, and DB
  // error text — admin-only. Unauthenticated callers get the summary shape
  // (load-balancer friendly) even when they ask for detailed.
  const adminSession = wantsDetailed ? await requireAdmin() : null;
  const detailed = wantsDetailed && (process.env.NODE_ENV === 'test' || !!adminSession);

  const database = await checkDatabase();
  const outbox = await checkOutbox(detailed);
  const disk = checkDisk();
  const memory = getMemoryUsage();
  const cpu = getCpuUsage();
  const uptime = process.uptime();

  const uploadsRoot = process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads');
  const backupRoot = process.env.BACKUP_ROOT || join(process.cwd(), 'data', 'backups');
  const uploadPath = checkWritable(uploadsRoot);
  const backupPath = checkWritable(backupRoot);

  const checks = {
    database,
    outbox,
    disk,
    memory,
    cpu,
    uploadPath: {
      status:
        uploadPath.exists && uploadPath.writable ? ('healthy' as const) : ('degraded' as const),
      // P1: absolute server paths must not leak to unauthenticated callers.
      ...(detailed ? { path: uploadsRoot } : {}),
      exists: uploadPath.exists,
      writable: uploadPath.writable,
    },
    backupPath: {
      status:
        backupPath.exists && backupPath.writable ? ('healthy' as const) : ('degraded' as const),
      ...(detailed ? { path: backupRoot } : {}),
      exists: backupPath.exists,
      writable: backupPath.writable,
    },
    uptime: { status: 'healthy' as const, seconds: Math.round(uptime) },
  };

  const anyUnhealthy = Object.values(checks).some((c: any) => c.status === 'unhealthy');
  const anyDegraded = Object.values(checks).some((c: any) => c.status === 'degraded');

  const status = anyUnhealthy ? 'unhealthy' : anyDegraded ? 'degraded' : 'healthy';
  const statusCode = status === 'unhealthy' ? 503 : 200;

  // P2-1: the public (non-detailed) body strips version, serviceMode,
  // and outbox.queueDepth so anonymous load-balancer callers can't
  // fingerprint the build or read operational internals.
  const body: Record<string, unknown> = {
    status,
    checks,
    timestamp: new Date().toISOString(),
    ...(detailed ? { version: VERSION, serviceMode: 'local_laptop' } : {}),
  };

  if (!detailed) {
    body.checks = {
      database: { status: checks.database.status },
      // queueDepth is operational internals; only show it to admins.
      outbox: { status: checks.outbox.status },
      disk: { status: checks.disk.status },
      uploadPath: { status: checks.uploadPath.status },
      backupPath: { status: checks.backupPath.status },
      uptime: { status: checks.uptime.status },
    };
  }

  return NextResponse.json(body, { status: statusCode });
}
