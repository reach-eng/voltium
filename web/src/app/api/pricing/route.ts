import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { pricingUseCases } from '@/server/modules/pricing/pricing.use-cases';

export async function GET(request: NextRequest) {
  try {
    const hubId = request.nextUrl.searchParams.get('hubId');
    const basePriceParam = request.nextUrl.searchParams.get('basePrice');

    if (!hubId) return errors.validation('hubId is required');
    if (!basePriceParam) return errors.validation('basePrice is required');

    const basePriceRupees = parseFloat(basePriceParam);
    if (isNaN(basePriceRupees) || basePriceRupees <= 0) return errors.validation('basePrice must be a positive number');

    const result = await pricingUseCases.calculate(hubId, basePriceRupees);
    return success(result, 'Dynamic price calculated');
  } catch (err: any) {
    if (err.message === 'Hub not found') return errors.notFound(err.message);
    if (err.message === 'Hub is currently inactive') return errors.badRequest(err.message);
    logger.error('[GET /api/pricing]', err);
    return errors.internal('Failed to calculate pricing');
  }
}
