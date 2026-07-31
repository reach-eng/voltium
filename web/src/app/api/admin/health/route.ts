import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/permissions';

export async function GET(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();
    if (!hasPermission(session, 'health_view')) return adminForbidden();
    const startTime = Date.now();
    await db.$queryRaw`SELECT 1`;
    const dbLatencyMs = Date.now() - startTime;

    return success(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: {
          status: 'up',
          latencyMs: dbLatencyMs,
        },
        uptimeSeconds: process.uptime(),
      },
      'Admin health status'
    );
  } catch (error) {
    logger.error('GET /api/admin/health error:', error);
    return errors.internal('Admin health check failed');
  }
}
