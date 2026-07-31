import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { validateBody, subscribePlanSchema } from '@/lib/validators';
import { requireRiderSession } from '@/lib/rider-auth';
import { planUseCases } from '@/server/modules/plans/plan.use-cases';
import { WalletServiceError } from '@/server/modules/wallet/wallet-ledger.service';

import { getOrSetResponse } from '@/lib/cache';

export async function GET() {
  try {
    const plans = await getOrSetResponse('rider_plans', async () => planUseCases.listActivePlans(), 300);
    return success(plans, `${plans.length} plans fetched`);
  } catch (err) {
    logger.error('[GET /api/rider/plans]', err);
    return errors.internal('Failed to fetch plans');
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRiderSession(req);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const body = await req.json();
    const validation = validateBody(subscribePlanSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error!);
    }

    const { planId, advanceRentPaid } = validation.data;

    const result = await planUseCases.subscribeToPlan(riderDbId, planId, advanceRentPaid);
    return success(result, `Subscribed to ${result.planName} plan`);
  } catch (err) {
    if (err instanceof Error && (err instanceof Error ? err.message : String(err)) === 'INSUFFICIENT_BALANCE') {
      return errors.badRequest('Insufficient wallet balance');
    }
    if (err instanceof WalletServiceError && err.code === 'INSUFFICIENT_BALANCE') {
      return errors.badRequest((err instanceof Error ? err.message : String(err)));
    }
    if (err instanceof Error && (err instanceof Error ? err.message : String(err)) === 'Plan is not active') {
      return errors.badRequest('Plan is not active');
    }
    if (err instanceof Error && (err instanceof Error ? err.message : String(err)) === 'INVALID_STATE_FOR_PLAN_SELECTION') {
      return errors.badRequest('Invalid state for plan selection. Please complete previous steps.');
    }
    if (
      err instanceof Error &&
      ((err instanceof Error ? err.message : String(err)) === 'Rider not found' || (err instanceof Error ? err.message : String(err)) === 'Plan not found')
    ) {
      return errors.notFound((err instanceof Error ? err.message : String(err)));
    }
    logger.error('[POST /api/rider/plans]', err);
    return errors.internal('Failed to subscribe to plan');
  }
}
