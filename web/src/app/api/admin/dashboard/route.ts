import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
// P1: canonical module (was lib/services/dashboard — now a re-export shim).
import { analyticsUseCases } from '@/server/modules/analytics/analytics.use-cases';
import { getOrSetResponse } from '@/lib/cache';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';

// GET /api/admin/dashboard — aggregate stats (cached 60s)
// ?trend=true — also returns 7-day revenue & rider trend
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // Pass the session (not just the role string) so explicit per-admin
  // grants are honored alongside the role matrix.
  if (!hasPermission(session, 'analytics_view')) return adminForbidden();

  // 15-query fan-out per call × workers × admins — cap per-admin polling.
  // Keyed on stable adminId (no shared role-bucket fallback); failClosed so
  // a limiter outage doesn't open an unlimited window on this fan-out.
  const DASHBOARD_RATE_LIMIT = { windowMs: 60_000, maxRequests: 60, failClosed: true };
  const rl = await checkRateLimit(
    `admin:dashboard:${session.adminId || 'unknown'}`,
    DASHBOARD_RATE_LIMIT
  );
  if (!rl.allowed) {
    return errors.tooManyRequests('Too many requests. Please try again later.', {
      rateLimit: {
        limit: DASHBOARD_RATE_LIMIT.maxRequests,
        remaining: rl.remaining,
        resetAt: rl.resetAt,
      },
    });
  }

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
