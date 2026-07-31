import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, ticketBulkActionSchema } from '@/lib/validators';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { adminSupportUseCases } from '@/server/modules/support/admin-support.use-cases';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();
    if (!hasPermission(session.adminRole || '', 'tickets_manage')) return adminForbidden();

    const body = await req.json();
    const validation = validateBody(ticketBulkActionSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const { ids, action, value } = validation.data;
    const result = await adminSupportUseCases.bulkUpdateTickets(
      ids,
      action,
      value,
      session.adminId || ''
    );

    return success(result, 'Bulk action completed');
  } catch (error) {
    if (error instanceof Error && (error instanceof Error ? error.message : String(error)).includes('is required')) {
      return errors.badRequest((error instanceof Error ? error.message : String(error)));
    }
    return errors.internal('Failed to process bulk action');
  }
}
