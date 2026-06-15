import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
  const start = Date.now();

  try {
    // Check if outbox table exists and has stuck events
    let pendingCount = 0;
    let failedCount = 0;
    let oldestPendingAge: number | null = null;

    try {
      const pending = (await db.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "OutboxEvent" WHERE status = 'PENDING'`
      )) as any;
      pendingCount = Number(pending[0]?.count ?? 0);

      const failed = (await db.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "OutboxEvent" WHERE status = 'FAILED'`
      )) as any;
      failedCount = Number(failed[0]?.count ?? 0);

      const oldest = (await db.$queryRawUnsafe(
        `SELECT EXTRACT(EPOCH FROM (NOW() - created_at))::int as age_seconds
         FROM "OutboxEvent"
         WHERE status = 'PENDING'
         ORDER BY created_at ASC
         LIMIT 1`
      )) as any;
      oldestPendingAge = oldest[0]?.age_seconds ?? null;
    } catch {
      // OutboxEvent table may not exist
    }

    // Check if there are any stuck processing events (> 5 minutes)
    let stuckCount = 0;
    try {
      const stuck = (await db.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "OutboxEvent"
         WHERE status = 'PROCESSING'
         AND updated_at < NOW() - INTERVAL '5 minutes'`
      )) as any;
      stuckCount = Number(stuck[0]?.count ?? 0);
    } catch {
      // Ignore
    }

    const latencyMs = Date.now() - start;
    const healthy = stuckCount === 0 && failedCount < 100;

    return NextResponse.json({
      status: healthy ? 'healthy' : 'degraded',
      latencyMs,
      pending: pendingCount,
      failed: failedCount,
      stuck: stuckCount,
      oldestPendingAgeSeconds: oldestPendingAge,
      timestamp: new Date().toISOString(),
    }, { status: healthy ? 200 : 503 });
  } catch (err: any) {
    logger.error('[Health/Worker] Worker check failed', { error: err?.message });

    return NextResponse.json(
      {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: err?.message ?? 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
