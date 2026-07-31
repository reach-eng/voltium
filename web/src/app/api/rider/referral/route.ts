import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { referralUseCases } from '@/server/modules/referrals/referral.use-cases';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const data = await referralUseCases.getReferralInfo(riderDbId);
    return success(data);
  } catch (err) {
    logger.error('[GET /api/rider/referral]', err);
    return errors.internal('Failed to fetch referral data');
  }
}
