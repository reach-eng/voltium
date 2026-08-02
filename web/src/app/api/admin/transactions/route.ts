/**
 * GET  /api/admin/transactions   — list with filters (paginated)
 * PUT  /api/admin/transactions   — approve | reject | reverse
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 * All business logic lives in transactionUseCases / walletLedgerService.
 */

import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { validateBody } from '@/lib/validators';
import { parseDDMMYYYY } from '@/lib/date-utils';
import { getOrSetResponse, invalidateCache } from '@/lib/cache';
import { approveTransactionSchema } from '@/server/modules/transactions/transaction.schemas';
import {
  transactionUseCases,
  TransactionError,
} from '@/server/modules/transactions/transaction.use-cases';
import { TransactionStateError } from '@/server/modules/transactions/transaction-state-machine';
import { WalletServiceError } from '@/lib/services/wallet-service';
import { DepositStateError } from '@/lib/services/deposit-service';

// GET /api/admin/transactions — list with filters, amounts in rupees
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'transactions_view')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const status = url.searchParams.get('status') || '';
    const type = url.searchParams.get('type') || '';
    const search = url.searchParams.get('search') || '';
    // Accept both DD-MM-YYYY (canonical) and ISO 8601 (legacy) for
    // backward compatibility with existing API clients.
    const startDateRaw = url.searchParams.get('startDate') || '';
    const endDateRaw = url.searchParams.get('endDate') || '';
    const startDate = startDateRaw
      ? parseDDMMYYYY(startDateRaw)?.toISOString() || startDateRaw
      : '';
    const endDate = endDateRaw
      ? parseDDMMYYYY(endDateRaw)?.toISOString() || endDateRaw
      : '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20')), 100);

    const cacheKey = [
      'admin:transactions',
      session.adminId ?? session.riderDbId ?? 'anon',
      status,
      type,
      search,
      startDate,
      endDate,
      page,
      limit,
    ].join(':');

    const result = await getOrSetResponse(cacheKey, () =>
      transactionUseCases.list({
        status,
        type,
        search,
        startDate,
        endDate,
        page,
        limit,
      }),
      5
    );

    if (!result) return errors.internal('Failed to fetch transactions');
    return withCacheHeaders(success(result.transactions, undefined, 200, result.pagination), 5);
  } catch (error) {
    logger.error('Transactions list error:', error);
    return errors.internal('Failed to fetch transactions');
  }
}

// PUT /api/admin/transactions — approve / reject / reverse
export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'transactions_approve')) return adminForbidden();

  const adminId = session.adminId || '';

  try {
    const body = await req.json();
    const validation = validateBody(approveTransactionSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { id, action, rejectionReason, walletCreditAmount } = validation.data;

    const result = await transactionUseCases.approveTransaction({
      transactionId: id,
      action: action as 'APPROVE' | 'REJECT' | 'REVERSE',
      rejectionReason,
      walletCreditAmount,
      adminId,
    });

    invalidateCache('admin:*');
    return success(result, `Transaction ${action.toLowerCase()}d`);
  } catch (error) {
    if (error instanceof TransactionError) {
      return errors.badRequest((error instanceof Error ? error.message : String(error)));
    }
    if (error instanceof TransactionStateError) {
      return errors.conflict((error instanceof Error ? error.message : String(error)));
    }
    if (error instanceof WalletServiceError) {
      return errors.badRequest((error instanceof Error ? error.message : String(error)));
    }
    if (error instanceof DepositStateError) {
      return errors.conflict((error instanceof Error ? error.message : String(error)));
    }
    if (error instanceof Error && (error instanceof Error ? error.message : String(error)).includes('not found')) {
      return errors.notFound((error instanceof Error ? error.message : String(error)));
    }
    if (error instanceof Error && (error instanceof Error ? error.message : String(error)).includes('deposit')) {
      return errors.conflict((error instanceof Error ? error.message : String(error)));
    }
    logger.error('Update transaction error:', error);
    return errors.internal('Failed to update transaction');
  }
}

// Compatibility for generated clients that submit admin transaction actions with POST.
export const POST = PUT;
