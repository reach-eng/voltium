import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { offerUseCases } from '@/server/modules/offers/offer.use-cases';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    const offers = await offerUseCases.getActiveSponsored();
    return success({ offers });
  } catch (err) {
    return errors.internal('Failed to fetch sponsored offers');
  }
}
