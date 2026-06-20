import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, hubBulkActionSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { hubUseCases } from '@/server/modules/hubs/hub.use-cases';

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'hubs_manage')) return adminForbidden();
  try {
    const body = await req.json();
    const validation = validateBody(hubBulkActionSchema, body);
    if (!validation.success) return errors.validation(validation.error!);
    const { action, ids } = validation.data;
    let result: { count: number };
    switch (action) {
      case 'activate':
        result = await hubUseCases.bulkActivate(ids, session.adminId || '');
        break;
      case 'deactivate':
        result = await hubUseCases.bulkDeactivate(ids, session.adminId || '');
        break;
      case 'delete':
        result = await hubUseCases.bulkDelete(ids, session.adminId || '');
        break;
      default:
        return errors.validation('Invalid action');
    }
    return success(result, `Bulk ${action} completed`);
  } catch (error: any) {
    if (error?.message?.includes?.('Cannot delete')) {
      return errors.conflict(error.message);
    }
    logger.error('POST /api/admin/hubs/bulk error:', error);
    return errors.internal('Bulk operation failed');
  }
}
