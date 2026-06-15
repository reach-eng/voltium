import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { getDashboardStats, getRevenueTrend } from '@/lib/services/dashboard';
import { getCachedResponse, cacheResponse } from '@/lib/cache';
import { requireAdmin, adminUnauthorized } from '@/lib/rbac';

// GET /api/admin/dashboard — aggregate stats (cached 60s)
// ?trend=true — also returns 7-day revenue & rider trend
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  const includeTrend = req.nextUrl.searchParams.get('trend') === 'true';
  const cacheKey = includeTrend ? 'admin:dashboard:stats:trend' : 'admin:dashboard:stats';

  // Check cache first
  const cached = getCachedResponse<ReturnType<typeof getDashboardStats>>(cacheKey);
  if (cached) {
    return success(cached);
  }

  try {
    const [stats, trend] = await Promise.all([
      getDashboardStats(),
      includeTrend ? getRevenueTrend(7) : Promise.resolve(null),
    ]);

    const data = trend ? { ...stats, trend } : stats;

    // Cache for 60 seconds
    cacheResponse(cacheKey, data, 60);

    return success(data);
  } catch (error) {
    logger.error('Dashboard stats error:', error);
    return errors.internal('Failed to fetch dashboard stats');
  }
}
