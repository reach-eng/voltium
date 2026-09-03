import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
// P1: canonical module (was lib/services/dashboard — now a re-export shim).
import { analyticsUseCases } from '@/server/modules/analytics/analytics.use-cases';
import { getOrSetResponse } from '@/lib/cache';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';

// GET /api/admin/dashboard — aggregate stats (cached 60s)
// ?trend=true — also returns 7-day revenue & rider trend
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'analytics_view')) return adminForbidden();

  const includeTrend = req.nextUrl.searchParams.get('trend') === 'true';
  const cacheKey = includeTrend ? 'admin:dashboard:stats:trend' : 'admin:dashboard:stats';

  try {
    const data = await getOrSetResponse(cacheKey, async () => {
      const [stats, trend] = await Promise.all([
        analyticsUseCases.getDashboardStats(),
        includeTrend ? analyticsUseCases.getRevenueTrend(7) : Promise.resolve(null),
      ]);
      return trend ? { ...stats, trend } : stats;
    }, 60);

    return withCacheHeaders(success(data), 10);
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    return errors.internal('Failed to fetch dashboard stats');
  }
}
