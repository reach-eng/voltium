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
import { parsePositiveInt } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const url = request.nextUrl;
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 100);

    // H6-2026-08-13: audience filter. Default USER so riders only see
    // their own top-ups and deposits; admin tools can pass ?audience=ALL
    // to see system flows (rent, rewards, reversals, etc.).
    const rawAudience = (url.searchParams.get('audience') || 'USER').toUpperCase();
    const audience: 'USER' | 'SYSTEM' | 'ALL' =
      rawAudience === 'ALL' || rawAudience === 'SYSTEM' || rawAudience === 'USER'
        ? (rawAudience as 'USER' | 'SYSTEM' | 'ALL')
        : 'USER';

    const result = await transactionUseCases.getByRiderId(
      riderDbId,
      page,
      limit,
      audience
    );

    logger.info('Transaction history fetched', {
      riderId: riderDbId,
      count: result.transactions.length,
      page,
      audience,
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
  const auth = await requireRiderSession(request);
  if (auth instanceof Response) return auth;
  return errors.forbidden('Transaction history is immutable and cannot be deleted', {
    details: { code: 'HISTORY_IMMUTABLE' },
  });
}
