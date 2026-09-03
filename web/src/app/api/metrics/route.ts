import { NextRequest, NextResponse } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized } from '@/lib/rbac';
import { getMetrics, getSlowQueries } from '@/lib/apm';
import { metricsRegistry } from '@/lib/prometheus';

export const dynamic = 'force-dynamic';

async function isAuthorizedMetricsCaller(req: NextRequest): Promise<boolean> {
  const tokenHeader = req.headers.get('x-internal-metrics-token');
  const expectedToken = process.env.INTERNAL_METRICS_TOKEN;
  if (expectedToken && tokenHeader === expectedToken) {
    return true;
  }
  const session = await requireAdmin();
  return !!session;
}

export async function GET(req: NextRequest) {
  const isAuth = await isAuthorizedMetricsCaller(req);
  if (!isAuth) {
    return adminUnauthorized();
  }

  const format = req.nextUrl.searchParams.get('format');
  const type = req.nextUrl.searchParams.get('type') || 'summary';

  if (format === 'json' || type === 'slow') {
    try {
      if (type === 'slow') {
        const slowQueries = getSlowQueries();
        return success(slowQueries, 'Slow queries retrieved');
      }

      const metrics = getMetrics();
      return success(metrics, 'Performance metrics retrieved');
    } catch (error) {
      logger.error('[METRICS_GET]', error);
      return errors.internal('Failed to fetch metrics');
    }
  }

  // Default to Prometheus text format
  try {
    const metrics = await metricsRegistry.metrics();
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': metricsRegistry.contentType,
      },
    });
  } catch (ex) {
    logger.error('Failed to generate prometheus metrics', { ex });
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
