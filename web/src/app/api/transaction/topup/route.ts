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
import { WalletServiceError } from '@/server/modules/wallet/wallet.errors';
import { rupeesToPaise } from '@/lib/money';
import { toRupeesResponse } from '@/lib/api-money';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    let body;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid request body');
    }

    const validation = validateBody(topUpSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { amount, purpose, method, upiRef, proofUrl, gatewayStatus, mdrAmount } = validation.data;
    const amountInPaise = rupeesToPaise(amount);

    // Use wallet use-case which handles idempotency, security deposit detection, test mode, and instant payment approval/rejection
    const transaction = await walletUseCases.requestTopup(
      riderDbId,
      amountInPaise,
      purpose || '',
      method || 'UPI',
      {
        upiRef: upiRef || undefined,
        proofUrl: proofUrl || undefined,
        idempotencyKey: request.headers.get('x-idempotency-key') || undefined,
        gatewayStatus: gatewayStatus || undefined,
        mdrAmount: mdrAmount || undefined,
      }
    );

    let responseMessage = 'Payment submitted for verification';
    if (transaction.status === 'APPROVED') {
      responseMessage = method === 'INSTANT' ? 'Instant payment approved and credited to wallet' : 'Payment auto-approved';
    } else if (transaction.status === 'REJECTED') {
      responseMessage = 'Instant payment declined by payment gateway';
    }

    return success(
      toRupeesResponse(transaction),
      responseMessage
    );
  } catch (err: unknown) {
    logger.error('[POST /api/transaction/topup]', err);
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'Rider not found') {
      return errors.notFound('Rider not found');
    }
    if (err instanceof WalletServiceError) {
      return errors.badRequest(err.message);
    }
    return errors.internal('Failed to submit payment');
  }
}
