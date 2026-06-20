/**
 * POST /api/transaction/request — Create a transaction request
 *
 * Thin route handler: auth + parse + call use-case + respond.
 * Business logic lives in walletUseCases (idempotency, deposit tracking).
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, topUpSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { walletUseCases } from '@/server/modules/wallet/wallet.use-cases';
import { rupeesToPaise } from '@/lib/flatten-rider';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const body = await request.json();
    const validation = validateBody(topUpSchema, body);
    if (!validation.success) {
      return errors.badRequest(`Validation failed: ${validation.error}`);
    }

    const { amount, purpose, method, upiRef, proofUrl } = validation.data;
    const amountInPaise = rupeesToPaise(amount);
    const finalPurpose = purpose || 'TOP_UP';

    // Use wallet use-case which handles idempotency and deposit record tracking
    const transaction = await walletUseCases.requestTopup(
      riderDbId,
      amountInPaise,
      finalPurpose,
      method || 'UPI',
      {
        upiRef: upiRef || undefined,
        proofUrl: proofUrl || undefined,
        idempotencyKey: request.headers.get('x-idempotency-key') || undefined,
      }
    );

    logger.info('Pending transaction created', {
      riderId: riderDbId,
      txId: transaction.id,
      amount,
    });

    return success(transaction, 'Transaction request submitted successfully');
  } catch (err: any) {
    if (err?.message?.includes('already submitted') || err?.message?.includes('Idempotent')) {
      return success(err.transaction || {}, 'Transaction already submitted');
    }
    logger.error('Failed to create pending transaction', err);
    return errors.internal('Failed to process request');
  }
}
