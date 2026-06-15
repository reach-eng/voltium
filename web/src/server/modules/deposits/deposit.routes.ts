/**
 * Deposits module - Routes.
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 */

import { NextRequest } from 'next/server';
import { requireRiderSession } from '@/lib/rider-auth';
import { requirePermission } from '@/lib/rbac';
import { depositUseCases } from './deposit.use-cases';
import { submitDepositSchema, reviewDepositSchema } from './deposit.schemas';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';

export async function GET_status(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const deposit = await depositUseCases.getDepositStatus(session.riderDbId);
  return success(deposit);
}

export async function POST_submit(request: NextRequest) {
  const session = await requireRiderSession(request);
  if ('status' in session) return session;

  const body = await request.json();
  const validation = validateBody(submitDepositSchema, { ...body, riderId: session.riderDbId });
  if (!validation.success) return errors.validation(validation.error);

  const result = await depositUseCases.submitDeposit(
    session.riderDbId,
    validation.data.amount,
    validation.data.proofUrl
  );
  return success(result, 'Deposit submitted for verification');
}

export async function POST_review(request: NextRequest) {
  const admin = await requirePermission('transactions_approve');
  if (!admin) return errors.forbidden('Insufficient permissions');

  const body = await request.json();
  const validation = validateBody(reviewDepositSchema, body);
  if (!validation.success) return errors.validation(validation.error);

  const result = await depositUseCases.reviewDeposit(
    validation.data.riderId,
    admin.adminId || admin.riderDbId,
    validation.data
  );
  return success(result, `Deposit ${validation.data.action.toLowerCase()}d`);
}
