import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { validateBody, subscribePlanSchema } from '@/lib/validators';
import { requireRiderSession } from '@/lib/rider-auth';
import { planUseCases } from '@/server/modules/plans/plan.use-cases';
import { WalletServiceError } from '@/server/modules/wallet/wallet-ledger.service';

export async function GET() {
  try {
    const plans = await planUseCases.listActivePlans();
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

    const { planId } = validation.data;

    const result = await planUseCases.subscribeToPlan(riderDbId, planId);
    return success(result, `Subscribed to ${result.planName} plan`);
  } catch (err) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_BALANCE') {
      return errors.badRequest('Insufficient wallet balance');
    }
    if (err instanceof WalletServiceError && err.code === 'INSUFFICIENT_BALANCE') {
      return errors.badRequest(err.message);
    }
    if (err instanceof Error && err.message === 'Plan is not active') {
      return errors.badRequest('Plan is not active');
    }
    if (
      err instanceof Error &&
      (err.message === 'Rider not found' || err.message === 'Plan not found')
    ) {
      return errors.notFound(err.message);
    }
    logger.error('[POST /api/rider/plans]', err);
    return errors.internal('Failed to subscribe to plan');
  }
}
