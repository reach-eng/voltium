import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { offerUseCases } from '@/server/modules/offers/offer.use-cases';

import { getOrSetResponse } from '@/lib/cache';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    const offers = await getOrSetResponse('rider_offers', async () => offerUseCases.getActiveSponsored(), 300);
    return success({ offers });
  } catch (err) {
    return errors.internal('Failed to fetch sponsored offers');
  }
}
