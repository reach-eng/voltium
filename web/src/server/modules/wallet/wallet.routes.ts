/**
 * Wallet module - Routes.
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 */

import { NextRequest } from 'next/server';
import { requireRiderSession } from '@/lib/rider-auth';
import { requirePermission, requireAdmin } from '@/lib/rbac';
import { walletUseCases } from './wallet.use-cases';
import { walletTopupSchema } from './wallet.schemas';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';

export async function GET_balance(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const wallet = await walletUseCases.getWallet(session.riderDbId);
  return success(wallet);
}

export async function POST_topup(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const body = await request.json();
  const validation = validateBody(walletTopupSchema, body);
  if (!validation.success) {
    return errors.validation(validation.error);
  }

  const result = await walletUseCases.requestTopup(
    session.riderDbId,
    validation.data.amount,
    validation.data.purpose || '',
    'UPI'
  );
  return success(result, 'Top-up request submitted');
}
