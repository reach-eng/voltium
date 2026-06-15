import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { calculateDynamicPrice } from '@/lib/dynamic-pricing';
import { rupeesToPaise, paiseToRupees } from '@/lib/flatten-rider';
import { logger } from '@/lib/logger';
import { pricingUseCases } from '@/server/modules/pricing/pricing.use-cases';

const PLANS = [
  { id: 'daily', name: 'Daily Flex', basePrice: 180 },
  { id: 'weekly', name: 'Weekly Pro', basePrice: 999 },
  { id: 'monthly', name: 'Monthly Max', basePrice: 2999 },
] as const;

export async function GET(request: NextRequest) {
  try {
    const hubId = request.nextUrl.searchParams.get('hubId');

    if (!hubId) {
      return errors.validation('hubId is required');
    }

    const hubPricing = await pricingUseCases.getHubPricing(hubId);

    const availability = {
      hubId: hubPricing.hub.id,
      hubName: hubPricing.hub.name,
      totalVehicles: hubPricing.totalVehicles,
      availableVehicles: hubPricing.availableVehicles,
      availabilityRatio: hubPricing.totalVehicles > 0 ? hubPricing.availableVehicles / hubPricing.totalVehicles : 0,
    };

    const planPricing = PLANS.map((plan: any) => {
      const basePricePaise = rupeesToPaise(plan.basePrice);
      const dynamic = calculateDynamicPrice(basePricePaise, availability);
      return {
        id: plan.id,
        name: plan.name,
        basePrice: paiseToRupees(dynamic.basePrice),
        finalPrice: paiseToRupees(dynamic.finalPrice),
        discount: dynamic.discount,
        discountLabel: dynamic.discountLabel,
        tier: dynamic.tier,
      };
    });

    return success(
      {
        hub: { id: hubPricing.hub.id, name: hubPricing.hub.name },
        availability,
        plans: planPricing,
      },
      'Plan pricing fetched'
    );
  } catch (err) {
    if (err instanceof Error && err.message === 'Hub not found') {
      return errors.notFound('Hub not found');
    }
    if (err instanceof Error && err.message === 'Hub is currently inactive') {
      return errors.badRequest('Hub is currently inactive');
    }
    logger.error('[GET /api/rider/pricing]', err);
    return errors.internal('Failed to fetch plan pricing');
  }
}
