import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { referralUseCases } from '@/server/modules/referrals/referral.use-cases';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRiderSession(req);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const result = await referralUseCases.getReferrals(riderDbId);
    if (!result) return errors.notFound('Referral code not found for this rider');

    return success(result, 'Referral data fetched');
  } catch (err) {
    logger.error('[GET /api/rider/referrals]', err);
    return errors.internal('Failed to fetch referral data');
  }
}
