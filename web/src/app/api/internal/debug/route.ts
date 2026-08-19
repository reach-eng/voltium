/**
 * GET /api/internal/debug — Comprehensive internal debug endpoint.
 *
 * Returns worker lag, outbox depth, circuit breaker states, rate limit info,
 * and system health metrics in a single response.
 *
 * PR-152: protected by `DEBUG_SECRET` (separate from `CRON_SECRET`).
 * The previous version used `CRON_SECRET` for both cron routes and
 * this debug endpoint, meaning a leaked cron secret exposed the full
 * debug surface (worker state, circuit breaker internals, etc.). Now
 * debug and cron use distinct secrets. Operators set `DEBUG_SECRET` in
 * env; if missing, the route 503s (refuses to start with no auth).
 *
 * Not exposed in admin UI; designed for PM2 / CLI troubleshooting.
 *
 * Usage:
 *   curl http://localhost:8081/api/internal/debug \
 *     -H "Authorization: Bearer ${DEBUG_SECRET}"
 */

import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import { getAllCircuitBreakers } from '@/lib/circuit-breaker';

function authorize(req: NextRequest): boolean {
  const auth = req.headers.get('authorization')?.replace('Bearer ', '');
  return auth === env.DEBUG_SECRET;
}

export async function GET(req: NextRequest) {
  if (!env.DEBUG_SECRET) {
    // Fail closed: refuse to expose debug info without a secret
    // configured. Operators must set DEBUG_SECRET in env to enable.
    return NextResponse.json(
      { error: 'DEBUG_SECRET not configured' },
      { status: 503 }
    );
  }
  if (!authorize(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const start = Date.now();
  const result: Record<string, any> = {
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    version: process.env.npm_package_version ?? '0.2.0',
    nodeEnv: env.NODE_ENV,
    appEnv: env.APP_ENV,
  };

  // 1. Outbox / Background Job stats
  try {
    const [
      pendingJobs,
      processingJobs,
      completedJobs,
      failedJobs,
      latestStuckJob
    ] = await Promise.all([
      db.outboxEvent.count({ where: { status: 'PENDING' } }),
      db.outboxEvent.count({ where: { status: 'PROCESSING' } }),
      db.outboxEvent.count({ where: { status: 'COMPLETED' } }),
      db.outboxEvent.count({ where: { status: 'FAILED' } }),
      db.outboxEvent.findFirst({
        where: { status: 'PROCESSING', updatedAt: { lt: new Date(Date.now() - 5 * 60000) } },
      }),
    ]);

    result.jobs = {
      pending: pendingJobs,
      processing: processingJobs,
      completed: completedJobs,
      failed: failedJobs,
      stuck: latestStuckJob ? latestStuckJob.id : null,
    };
  } catch (err: unknown) {
    result.jobs = { error: (err instanceof Error ? err.message : String(err)) };
  }

  // 2. Circuit breaker states
  try {
    result.circuitBreakers = getAllCircuitBreakers();
  } catch (err: unknown) {
    result.circuitBreakers = { error: (err instanceof Error ? err.message : String(err)) };
  }

  // 3. Rate limit stats
  try {
    result.rateLimit = {
      storeSize: 'database-backed',
      windowMs: 60_000,
    };
  } catch {
    result.rateLimit = { storeSize: 0 };
  }

  // 4. Database pool info
  try {
    const poolInfo = (await db.$queryRawUnsafe(
      `SELECT
         (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database())::int AS total,
         COALESCE((SELECT count(*) FROM pg_stat_activity WHERE state = 'idle' AND datname = current_database()), 0)::int AS idle,
         COALESCE((SELECT count(*) FROM pg_stat_activity WHERE state = 'active' AND datname = current_database()), 0)::int AS active,
         0 AS waiting`
    )) as Array<{
        total: number;
        idle: number;
        active: number;
        waiting: number;
      }>;
    result.database = {
      pool: poolInfo[0] ?? { total: 0, idle: 0, active: 0, waiting: 0 },
      latencyMs: Date.now() - start,
    };
  } catch {
    result.database = { error: 'unreachable' };
  }

  // 5. Dead-letter queue — (Removed, Outbox disabled)
  result.deadLetter = { total: 0, byType: [] };

  // 6. Storage paths
  try {
    const { StoragePathBuilder } = await import('@/lib/storage-path-builder');
    result.storage = {
      uploadsRoot: await StoragePathBuilder.getUploadsRoot(),
      backupRoot: await StoragePathBuilder.getBackupRoot(),
    };
  } catch {
    result.storage = { error: 'unavailable' };
  }

  result.latencyMs = Date.now() - start;
  return NextResponse.json(result);
}
