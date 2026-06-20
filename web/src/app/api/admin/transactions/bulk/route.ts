/**
 * POST /api/admin/transactions/bulk — bulk transaction actions
 *
 * Thin route handler: auth + parse + call use-case + respond.
 * Business logic lives in transactionUseCases.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { validateBody } from '@/lib/validators';
import { transactionBulkActionSchema } from '@/server/modules/transactions/transaction.schemas';
import { transactionUseCases } from '@/server/modules/transactions/transaction.use-cases';
import { withIdempotency } from '@/lib/api-middleware';

async function postHandler(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'transactions_approve')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(transactionBulkActionSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { ids, action } = validation.data;
    const adminId = session.adminId || '';

    const results: Array<{ id: string; status: string; error?: string }> = [];

    for (const id of ids) {
      try {
        const result = await transactionUseCases.approveTransaction({
          transactionId: id,
          action: action === 'approve' ? 'APPROVE' : 'REJECT',
          rejectionReason: body.reason,
          adminId,
        });
        results.push({ id, status: (result as any).status || action });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        results.push({ id, status: 'ERROR', error: message });
      }
    }

    return success({ results, count: results.length }, 'Bulk action completed');
  } catch (error) {
    logger.error('[BULK_TRANSACTION_ERROR]', error);
    return errors.internal('Bulk action failed');
  }
}

export const POST = (req: NextRequest) => withIdempotency(postHandler)(req);
export async function GET() {
  return success({ message: 'Bulk transaction API endpoint' });
}
