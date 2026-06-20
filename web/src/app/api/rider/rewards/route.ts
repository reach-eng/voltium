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

    const result = await riderUseCases.getRewards(riderDbId);
    if (!result) return errors.notFound('Rider not found');

    return success(result);
  } catch (err) {
    logger.error('[GET /api/rider/rewards]', err);
    return errors.internal('Failed to fetch rewards');
  }
}
