import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { pricingUseCases } from '@/server/modules/pricing/pricing.use-cases';

export async function GET(request: NextRequest) {
  try {
    // P0-7 (2026-08-05 ops audit): the endpoint was unauthenticated, exposing
    // per-hub utilization, surge multipliers, and fleet counts to anyone — a
    // competitor could scrape every hub's demand pattern. Require a rider
    // session (the Flutter app already sends the rider JWT on /api/rider/*
    // and the pricing call goes through the same authenticated client).
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    const hubId = request.nextUrl.searchParams.get('hubId');
    const basePriceParam = request.nextUrl.searchParams.get('basePrice');

    if (!hubId) return errors.validation('hubId is required');
    if (!basePriceParam) return errors.validation('basePrice is required');

    const basePriceRupees = parseFloat(basePriceParam);
    if (isNaN(basePriceRupees) || basePriceRupees <= 0)
      return errors.validation('basePrice must be a positive number');

    const result = await pricingUseCases.calculate(hubId, basePriceRupees);
    return success(result, 'Dynamic price calculated');
  } catch (err: unknown) {
    // P3-17 (2026-08-05 ops audit): the double `instanceof Error` per branch
    // was noise — extract the message once and match on it.
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'Hub not found') return errors.notFound(message);
    if (message === 'Hub is currently inactive') return errors.badRequest(message);
    logger.error('[GET /api/pricing]', err);
    return errors.internal('Failed to calculate pricing');
  }
}
