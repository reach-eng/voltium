import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const dashboard = await riderUseCases.getDashboard(riderDbId);
    if (!dashboard) return errors.notFound('Rider not found');

    return success(dashboard, 'Dashboard data fetched');
  } catch (err) {
    logger.error('[GET /api/rider/dashboard] Unhandled error:', err);
    return errors.internal('Failed to fetch dashboard data');
  }
}
