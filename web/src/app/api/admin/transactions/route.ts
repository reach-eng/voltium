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
import { parsePositiveInt } from '@/lib/api-utils';
import { withIdempotency } from '@/lib/api-middleware';
import { toRupeesResponse } from '@/lib/api-money';
import { approveTransactionSchema } from '@/server/modules/transactions/transaction.schemas';
import {
  transactionUseCases,
  TransactionError,
} from '@/server/modules/transactions/transaction.use-cases';
import { toStateAction } from '@/server/modules/transactions/transaction.types';
import { TransactionStateError } from '@/server/modules/transactions/transaction-state-machine';
// P1: error classes from the canonical module facades, not lib/ directly.
import { WalletServiceError } from '@/server/modules/wallet/wallet-ledger.service';
import { DepositStateError } from '@/server/modules/deposits/deposit-ledger.service';

// GET /api/admin/transactions — list with filters, amounts in rupees
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'transactions_view')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const status = url.searchParams.get('status') || '';
    const type = url.searchParams.get('type') || '';
    const purpose = url.searchParams.get('purpose') || '';
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
    // PR-4b (13th audit P0-6): `?page=abc` must fall back to 1, not NaN.
    const page = parsePositiveInt(url.searchParams.get('page'), 1);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 100);

    // P0-6 (financial audit): the adminId used to be part of the key, so every
    // admin kept their own duplicate copy of the same list — and a wildcard
    // 'admin:*' invalidation on every PUT cleared ALL admin caches. The key is
    // now shared (same data for every admin with the same filters) and
    // invalidation is scoped to 'admin:transactions:*'.
    const cacheKey = [
      'admin:transactions',
      status,
      type,
      purpose,
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
        purpose,
        search,
        startDate,
        endDate,
        page,
        limit,
      }),
      5
    );

    if (!result) return errors.internal('Failed to fetch transactions');
    return withCacheHeaders(success(toRupeesResponse(result.transactions), undefined, 200, result.pagination), 5);
  } catch (error) {
    logger.error('Transactions list error:', error);
    return errors.internal('Failed to fetch transactions');
  }
}

// PUT /api/admin/transactions — approve / reject / reverse
// P0-7 (financial audit): POST is an alias for PUT but bypassed idempotency,
// so a retried POST could not tell whether the credit happened. Both verbs
// now run through `withIdempotency` — a retry with the same x-idempotency-key
// replays the cached response instead of double-processing.
//
// Note: `withIdempotency` only engages for POST + x-idempotency-key (see
// api-middleware.ts — PUT short-circuits). That is the direction the audit
// cared about (generated clients retry POST); PUT retries without the key
// still re-execute, which is unchanged legacy behavior.
async function putHandler(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'transactions_approve')) return adminForbidden();

  const adminId = session.adminId || '';

  try {
    const body = await req.json();
    const validation = validateBody(approveTransactionSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { id, action, rejectionReason, walletCreditAmount } = validation.data;

    // P2-1 (financial audit): the action used to reach the use-case through
    // an unchecked `as` cast. `toStateAction` validates and normalizes it
    // once, producing the canonical type (P2-2/P3-21: one UPPERCASE
    // convention across routes).
    const stateAction = toStateAction(action);

    const result = await transactionUseCases.approveTransaction({
      transactionId: id,
      action: stateAction,
      rejectionReason,
      walletCreditAmount,
      adminId,
    });

    // P0-6: scoped invalidation — no more clearing every admin's cache.
    invalidateCache('admin:transactions:*');
    invalidateCache('admin:riders:*');
    return success(toRupeesResponse(result), `Transaction ${stateAction.toLowerCase()}d`);
  } catch (error) {
    // P0-2: lost CAS race (concurrent admin already processed it) → 409.
    if (error instanceof Error && (error as { code?: string }).code === 'CONFLICT') {
      return errors.conflict(error.message);
    }
    // P3-17 (financial audit): the error branches wrapped every message in a
    // redundant `error instanceof Error ? ... : String(error)` inside an
    // already-guarded instanceof — simplified to `error.message`.
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
    // P1: substring matching on ARBITRARY error text must not echo it —
    // Prisma/DB messages would leak table/constraint details. Domain error
    // classes above (with designed messages) still pass through.
    if (error instanceof Error && error.message.includes('not found')) {
      return errors.notFound('Transaction not found');
    }
    if (error instanceof Error && error.message.includes('deposit')) {
      return errors.conflict('Transaction conflicts with deposit state');
    }
    logger.error('Update transaction error:', error);
    return errors.internal('Failed to update transaction');
  }
}

export const PUT = (req: NextRequest) => withIdempotency(putHandler)(req);
// Compatibility for generated clients that submit admin transaction actions with POST.
export const POST = (req: NextRequest) => withIdempotency(putHandler)(req);
