import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized } from '@/lib/rbac';
import { getMetrics, getSlowQueries } from '@/lib/apm';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  try {
    const type = req.nextUrl.searchParams.get('type') || 'summary';

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
