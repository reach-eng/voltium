import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { hasPermission } from '@/lib/auth';
import { dataManagementUseCases } from '@/server/modules/data-management/data-management.use-cases';
import { restoreValidateSchema } from '@/server/modules/data-management/backup.schemas';
import type { AdminRole } from '@/server/modules/admin/admin.types';
import { withApiHandler } from '@/lib/api-handler';
import { success, errors } from '@/lib/api-response';

export const POST = withApiHandler(async (request: NextRequest) => {
  const session = await getAdminSession(request);
  if (!session) return errors.unauthorized('Unauthorized');

  if (!hasPermission(session.adminRole || '', 'data_management_restore')) {
    return errors.forbidden('Forbidden');
  }

  const body = restoreValidateSchema.parse(await request.json());
  const result = await dataManagementUseCases.validateRestore(
    body.backupId,
    session.adminId ?? '',
    session.adminRole as AdminRole
  );

  return success(result);
});
