import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { toRupeesResponse } from '@/lib/api-money';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    // Dashboard fans out to parallel DB reads + URL signing per call —
    // cap per-rider polling so a hot loop can't DoS the DB. failClosed:
    // an unlimited window during a limiter outage is the abuse hole.
    const DASHBOARD_RATE_LIMIT = { windowMs: 60_000, maxRequests: 60, failClosed: true };
    const rl = await checkRateLimit(`rider:dashboard:${riderDbId}`, DASHBOARD_RATE_LIMIT);
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many requests. Please try again later.', {
        rateLimit: {
          limit: DASHBOARD_RATE_LIMIT.maxRequests,
          remaining: rl.remaining,
          resetAt: rl.resetAt,
        },
      });
    }

    const dashboard = await riderUseCases.getDashboard(riderDbId);
    if (!dashboard) return errors.notFound('Rider not found');

    return success(toRupeesResponse(dashboard), 'Dashboard data fetched');
  } catch (err) {
    logger.error('[GET /api/rider/dashboard] Unhandled error:', err);
    return errors.internal('Failed to fetch dashboard data');
  }
}
