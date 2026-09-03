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
import { rupeesToPaise } from '@/lib/money';
import { toRupeesResponse } from '@/lib/api-money';

type IdempotentTransactionError = Error & { transaction?: unknown };

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const body = await request.json();
    const validation = validateBody(topUpSchema, body);
    if (!validation.success) {
      return errors.validation(`Validation failed: ${validation.error}`);
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

    return success(toRupeesResponse(transaction), 'Transaction request submitted successfully');
  } catch (err: unknown) {
    const error: IdempotentTransactionError =
      err instanceof Error ? (err as IdempotentTransactionError) : new Error(String(err));
    if (error.message.includes('already submitted') || error.message.includes('Idempotent')) {
      return success(error.transaction || {}, 'Transaction already submitted');
    }
    logger.error('Failed to create pending transaction', err);
    return errors.internal('Failed to process request');
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return errors.badRequest('Transaction ID is required');
    }

    const { db } = await import('@/lib/db');
    const transaction = await db.transaction.findUnique({
      where: { id },
    });

    if (!transaction || transaction.riderId !== riderDbId) {
      return errors.notFound('Transaction request not found');
    }

    return success(toRupeesResponse(transaction), 'Transaction request retrieved successfully');
  } catch (err: unknown) {
    logger.error('Failed to retrieve transaction request', err);
    return errors.internal('Failed to retrieve transaction request');
  }
}
