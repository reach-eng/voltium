/**
 * POST /api/transaction/topup — Submit a top-up request
 *
 * Thin route handler: auth + parse + call use-case + respond.
 * Business logic (idempotency, transaction creation, deposit tracking) lives in walletUseCases.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, topUpSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { walletUseCases } from '@/server/modules/wallet/wallet.use-cases';
import { paiseToRupees, rupeesToPaise } from '@/lib/flatten-rider';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    let body;
    try { body = await request.json(); } catch {
      return errors.badRequest('Invalid request body');
    }

    const validation = validateBody(topUpSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { amount, purpose, method, upiRef, proofUrl } = validation.data;
    const amountInPaise = rupeesToPaise(amount);

    // Use wallet use-case which handles idempotency, security deposit detection, test mode
    const transaction = await walletUseCases.requestTopup(
      riderDbId,
      amountInPaise,
      purpose || '',
      method || 'UPI',
      {
        upiRef: upiRef || undefined,
        proofUrl: proofUrl || undefined,
        idempotencyKey: request.headers.get('x-idempotency-key') || undefined
      }
    );

    return success(
      {
        id: transaction.id,
        amount: paiseToRupees(transaction.amount),
        status: transaction.status,
      },
      transaction.status === 'APPROVED'
        ? 'Payment auto-approved (test mode)'
        : 'Payment submitted for verification'
    );
  } catch (err: any) {
    logger.error('[POST /api/transaction/topup]', err);
    if (err?.message === 'Rider not found') {
      return errors.notFound('Rider not found');
    }
    return errors.internal('Failed to submit payment');
  }
}
