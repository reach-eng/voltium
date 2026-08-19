import { NextRequest, NextResponse } from 'next/server';
import { collectDefaultMetrics, Registry } from 'prom-client';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized } from '@/lib/rbac';
import { getMetrics, getSlowQueries } from '@/lib/apm';

export const dynamic = 'force-dynamic';

const register = new Registry();

// Collect default metrics (CPU, memory, event loop lag, etc.)
collectDefaultMetrics({ register });

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
    const metrics = await register.metrics();
    return new NextResponse(metrics, {
      status: 200,
      headers: {
        'Content-Type': register.contentType,
      },
    });
  } catch (ex) {
    logger.error('Failed to generate prometheus metrics', { ex });
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
