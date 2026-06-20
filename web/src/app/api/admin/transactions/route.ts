/**
 * GET  /api/admin/transactions   — list with filters (paginated)
 * PUT  /api/admin/transactions   — approve | reject | reverse
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 * All business logic lives in transactionUseCases / walletLedgerService.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { validateBody } from '@/lib/validators';
import { approveTransactionSchema } from '@/server/modules/transactions/transaction.schemas';
import { transactionUseCases, TransactionError } from '@/server/modules/transactions/transaction.use-cases';
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
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20')), 100);

    const result = await transactionUseCases.list({
      status, type, search, startDate, endDate, page, limit,
    });

    return success(result.transactions, undefined, 200, result.pagination);
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

    return success(result, `Transaction ${action.toLowerCase()}d`);
  } catch (error) {
    if (error instanceof TransactionError) {
      return errors.badRequest(error.message);
    }
    if (error instanceof TransactionStateError) {
      return errors.conflict(error.message);
    }
    if (error instanceof WalletServiceError) {
      return errors.badRequest(error.message);
    }
    if (error instanceof DepositStateError) {
      return errors.conflict(error.message);
    }
    if (error instanceof Error && error.message.includes('not found')) {
      return errors.notFound(error.message);
    }
    if (error instanceof Error && error.message.includes('deposit')) {
      return errors.conflict(error.message);
    }
    logger.error('Update transaction error:', error);
    return errors.internal('Failed to update transaction');
  }
}

// Compatibility for generated clients that submit admin transaction actions with POST.
export const POST = PUT;
