import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { Redis } from '@upstash/redis';
import { execSync } from 'child_process';

const VERSION = process.env.npm_package_version ?? '0.2.0';
const REDIS_CONFIGURED = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

let redis: import('@upstash/redis').Redis | null = null;
if (REDIS_CONFIGURED) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
}

function getDiskUsage(): { totalMB: number; freeMB: number; usedMB: number; usagePercent: number } {
  try {
    const output = execSync('df -m .').toString();
    const lines = output.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      const totalMB = parseInt(parts[1], 10);
      const usedMB = parseInt(parts[2], 10);
      const freeMB = parseInt(parts[3], 10);
      const usagePercent = Math.round((usedMB / totalMB) * 100);
      return { totalMB, freeMB, usedMB, usagePercent };
    }
  } catch {
    // Fallback for environments where df is unavailable (e.g. Windows)
  }
  return { totalMB: 0, freeMB: 0, usedMB: 0, usagePercent: 0 };
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

async function checkRedis(): Promise<{
  status: 'healthy' | 'unhealthy' | 'skipped';
  latencyMs: number;
  error?: string;
}> {
  if (!redis) {
    return { status: 'skipped', latencyMs: 0 };
  }
  const start = Date.now();
  try {
    await redis.ping();
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch (err: any) {
    logger.error('[Health] Redis check failed', { error: err?.message });
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
} {
  const disk = getDiskUsage();
  if (disk.usagePercent === 0) {
    return { status: 'healthy', usagePercent: 0, freeMB: 0 };
  }
  if (disk.usagePercent >= 95) {
    return { status: 'unhealthy', usagePercent: disk.usagePercent, freeMB: disk.freeMB };
  }
  if (disk.usagePercent >= 85) {
    return { status: 'degraded', usagePercent: disk.usagePercent, freeMB: disk.freeMB };
  }
  return { status: 'healthy', usagePercent: disk.usagePercent, freeMB: disk.freeMB };
}

export async function GET(request: NextRequest) {
  const detailed = request.nextUrl.searchParams.get('detailed') === 'true';

  const [database, redisCheck] = await Promise.all([checkDatabase(), checkRedis()]);
  const disk = checkDisk();
  const uptime = process.uptime();

  const checks = {
    database,
    redis: redisCheck,
    disk,
    uptime: { status: 'healthy' as const, seconds: Math.round(uptime) },
  };

  const anyUnhealthy = Object.values(checks).some((c) => c.status === 'unhealthy');
  const anyDegraded = Object.values(checks).some((c) => c.status === 'degraded');

  const status = anyUnhealthy ? 'unhealthy' : anyDegraded ? 'degraded' : 'healthy';
  const statusCode = status === 'unhealthy' ? 503 : status === 'degraded' ? 200 : 200;

  const body: Record<string, unknown> = {
    status,
    checks,
    timestamp: new Date().toISOString(),
    version: VERSION,
  };

  if (!detailed) {
    body.checks = {
      database: { status: checks.database.status },
      redis: { status: checks.redis.status },
      disk: { status: checks.disk.status },
      uptime: { status: checks.uptime.status },
    };
  }

  return NextResponse.json(body, { status: statusCode });
}
