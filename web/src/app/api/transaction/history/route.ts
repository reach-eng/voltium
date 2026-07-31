/**
 * GET    /api/transaction/history — list rider's transactions
 * DELETE /api/transaction/history — clear rider's transaction history
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 * Business logic lives in transactionUseCases.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { transactionUseCases } from '@/server/modules/transactions/transaction.use-cases';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const url = request.nextUrl;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.max(1, parseInt(url.searchParams.get('limit') || '20'));

    const result = await transactionUseCases.getByRiderId(riderDbId, page, limit);

    logger.info('Transaction history fetched', {
      riderId: riderDbId,
      count: result.transactions.length,
      page,
    });

    return success(
      { transactions: result.transactions, pagination: result.pagination },
      `${result.transactions.length} transactions fetched`
    );
  } catch (err) {
    logger.error('Failed to fetch transaction history', err);
    return errors.internal('Failed to fetch history');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    await transactionUseCases.deleteHistory(riderDbId);

    logger.info('Transaction history cleared', { riderId: riderDbId });
    return success(null, 'Transaction history cleared');
  } catch (err) {
    logger.error('Failed to clear transaction history', err);
    return errors.internal('Failed to clear history');
  }
}
