/**
 * POST /api/admin/transactions/bulk — bulk transaction actions
 *
 * Thin route handler: auth + parse + call use-case + respond.
 * Business logic lives in transactionUseCases.
 *
 * P0-3 (ADMIN_FINANCE_AUDIT_2026-08-05 + ADMIN_FINANCIAL_FLOWS_AUDIT_2026-08-05):
 * the route used to loop over up to 500 IDs and call approveTransaction
 * per ID, with each call in its own implicit transaction. A server
 * crash between IDs left the batch in a partial state (some approved,
 * some not) and the route returned 200 with a green toast over per-id
 * failures. Now:
 *   1. A pre-flight single query partitions the IDs into PENDING +
 *      already-processed buckets. Already-processed IDs are reported
 *      as `skipped` (not `error`) — the admin knows they were already
 *      done and didn't fail.
 *   2. The remaining PENDING IDs are processed concurrently via the
 *      use case (which is internally consistent: wallet-ledger credit
 *      + CAS status claim + audit log). Each per-ID failure is
 *      captured as a per-id result.
 *   3. The response distinguishes failed vs skipped counts and
 *      returns 207 Multi-Status if any non-PENDING or failure exists,
 *      200 if all succeeded.
 *   4. Future hardening: a `db.$transaction` wrapper around the whole
 *      batch (passing the same `tx` to every per-id use-case call) would
 *      make the entire batch atomic. Not done here because the use case's
 *      internal `tx` plumbing is not exposed; the bounded-concurrency +
 *      idempotency-key on the credit already gives a strong "duplicate
 *      is safe" guarantee.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { validateBody } from '@/lib/validators';
import { transactionBulkActionSchema } from '@/server/modules/transactions/transaction.schemas';
import { transactionUseCases } from '@/server/modules/transactions/transaction.use-cases';
import { toStateAction } from '@/server/modules/transactions/transaction.types';
import { db } from '@/lib/db';
import { invalidateCache } from '@/lib/cache';
import { withIdempotency } from '@/lib/api-middleware';

// P3-20 (financial audit): 500 IDs were processed in a sequential loop —
// ~50s of sequential DB transactions, past typical HTTP timeouts. Bounded
// concurrency cuts that to a few seconds. Kept at 4 to stay well under the
// Postgres connection pool limit (10) — each worker holds a pool connection
// across its multi-query sequence, so 8 workers sat at the edge and could
// exhaust the pool under concurrent traffic. Safe here because the P0-2 CAS
// claim makes each status transition single-winner and the P0-9 idempotency
// keys dedupe ledger replays.
const BULK_CONCURRENCY = 4;

/** P3-20: bounded-concurrency map that preserves input order (indexed writes). */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function postHandler(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'transactions_approve')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(transactionBulkActionSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { ids, action, reason, rejectionReason: rejReason } = validation.data;
    const finalReason = rejReason || reason;
    const adminId = session.adminId || '';

    // P2-2/P3-21: single normalization point — both routes now feed the
    // use-case the same canonical UPPERCASE action.
    const stateAction = toStateAction(action);

    // P0-3: pre-flight. One query partitions the IDs into PENDING vs
    // already-processed. Already-processed IDs are reported as
    // `skipped` (not `error`) so the admin can distinguish "this
    // race I lost to another admin" from "this actually failed".
    //
    // IDs that aren't in the DB at all (returned by the pre-flight) are
    // NOT marked as skipped — they're processed and the use case's
    // "Transaction not found" error is captured as a per-id failure
    // (the existing test contract). This keeps the pre-flight additive
    // (skipped is a new state, not_found is unchanged).
    const existing = await db.transaction.findMany({
      where: { id: { in: ids } },
      select: { id: true, status: true },
    });
    const statusById = new Map(existing.map((t: { id: string; status: string }) => [t.id, t.status]));
    const skipped: Array<{ id: string; status: string }> = [];
    const pending: string[] = [];
    for (const id of ids) {
      const status = statusById.get(id);
      if (status !== undefined && status !== 'PENDING') {
        skipped.push({ id, status });
      } else {
        // Either status === 'PENDING' (in DB, will process) or status is
        // undefined (not in DB, will fail in the use case).
        pending.push(id);
      }
    }

    const results = await mapWithConcurrency(pending, BULK_CONCURRENCY, async (id) => {
      try {
        const result = await transactionUseCases.approveTransaction({
          transactionId: id,
          action: stateAction,
          rejectionReason: finalReason,
          adminId,
        });
        // P1-6 (financial audit): report the ACTUAL outcome. The old
        // `(result as any).status || action` fallback masked missing statuses
        // with the requested action, making the response meaningless — a row
        // that errored still reported "approve". The use-case now returns the
        // canonical row (or { status: 'REVERSED' }), so `status` is always
        // populated; the fallback only covers defensive nullability.
        return { id, status: result.status ?? stateAction };
      } catch (e) {
        // P3-17: drop the redundant double `instanceof` cast.
        return { id, status: 'ERROR', error: e instanceof Error ? e.message : String(e) };
      }
    });

    const failed = results.filter((r) => r.status === 'ERROR').length;
    const succeeded = results.length - failed;
    // Pre-flight skipped (already-processed or not-found) is informational,
    // not a failure.
    const skippedCount = skipped.length;

    // P0-6: scoped invalidation — any mutation clears the shared transactions
    // list cache, regardless of outcome.
    invalidateCache('admin:transactions:*');

    // P0-3 (financial audit): the old code always returned 200 with per-ID
    // ERROR rows — a green toast over 50 failures. Any failure now surfaces
    // as 207 Multi-Status with an explicit `failed` count, so clients can
    // distinguish a partial run from a clean one. The skipped count is
    // returned separately so the admin sees the full picture.
    if (failed > 0 || skippedCount > 0) {
      return success(
        {
          results: [...results, ...skipped],
          count: ids.length,
          succeeded,
          failed,
          skipped: skippedCount,
        },
        `${failed} failed, ${skippedCount} skipped, ${succeeded} succeeded`,
        207
      );
    }

    return success(
      {
        results,
        count: ids.length,
        succeeded,
        failed: 0,
        skipped: 0,
      },
      'Bulk action completed'
    );
  } catch (error) {
    logger.error('[BULK_TRANSACTION_ERROR]', error);
    return errors.internal('Bulk action failed');
  }
}

export const POST = (req: NextRequest) => withIdempotency(postHandler)(req);
export async function GET() {
  return success({ message: 'Bulk transaction API endpoint' });
}
