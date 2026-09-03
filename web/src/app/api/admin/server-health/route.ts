/**
 * GET /api/admin/server-health — Admin server health & queue telemetry
 *
 * Provides authenticated administrators with full system health, hardware metrics,
 * and comprehensive outbox queue depth analytics.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();

    const allowed =
      hasPermission(session.adminRole || '', 'settings_manage') ||
      hasPermission(session.adminRole || '', 'jobs_view') ||
      hasPermission(session.adminRole || '', 'health_view');

    if (!allowed) {
      return adminForbidden();
    }

    const start = Date.now();

    // Query outbox queue depth telemetry
    const [pending, processing, failed, oldest, stuck] = await Promise.all([
      db.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "outbox_events" WHERE status = 'PENDING'`
      ) as Promise<any>,
      db.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "outbox_events" WHERE status = 'PROCESSING'`
      ) as Promise<any>,
      db.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "outbox_events" WHERE status = 'FAILED'`
      ) as Promise<any>,
      db.$queryRawUnsafe(
        `SELECT EXTRACT(EPOCH FROM (NOW() - "createdAt"))::int as age_seconds
         FROM "outbox_events"
         WHERE status = 'PENDING'
         ORDER BY "createdAt" ASC
         LIMIT 1`
      ) as Promise<any>,
      db.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "outbox_events"
         WHERE status = 'PENDING'
         AND "createdAt" < NOW() - INTERVAL '15 minutes'`
      ) as Promise<any>,
    ]);

    const queueDepth = Number(pending[0]?.count ?? 0);
    const processingCount = Number(processing[0]?.count ?? 0);
    const failedCount = Number(failed[0]?.count ?? 0);
    const oldestPendingAgeSeconds = oldest[0]?.age_seconds ?? null;
    const stuckCount = Number(stuck[0]?.count ?? 0);

    const memoryUsage = process.memoryUsage();
    const memory = {
      usedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      totalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
    };

    const outboxStatus =
      stuckCount > 0 || failedCount >= 100
        ? ('degraded' as const)
        : ('healthy' as const);

    const responseData = {
      status: outboxStatus,
      latencyMs: Date.now() - start,
      outbox: {
        status: outboxStatus,
        queueDepth,
        processingCount,
        failedCount,
        stuckCount,
        oldestPendingAgeSeconds,
      },
      memory,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };

    return success(responseData, 'Server health telemetry');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('[AdminServerHealth] Telemetry check failed', { error: message });
    return errors.internal(`Failed to read server health: ${message}`);
  }
}
