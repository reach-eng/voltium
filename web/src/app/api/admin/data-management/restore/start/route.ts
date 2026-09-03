import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { hasPermission } from '@/lib/auth';
import { dataManagementUseCases } from '@/server/modules/data-management/data-management.use-cases';
import { restoreStartSchema } from '@/server/modules/data-management/backup.schemas';
import type { AdminRole } from '@/server/modules/admin/admin.types';
import { withApiHandler } from '@/lib/api-handler';
import { success, errors } from '@/lib/api-response';

export const POST = withApiHandler(async (request: NextRequest) => {
  const session = await getAdminSession(request);
  if (!session) return errors.unauthorized('Unauthorized');

  if (!hasPermission(session.adminRole || '', 'data_management_restore')) {
    return errors.forbidden('Forbidden');
  }

  // P1: safeParse → 422 (was .parse() → 500 + raw Zod text on bad input).
  const parsed = restoreStartSchema.safeParse(await request.json());
  if (!parsed.success) return errors.validation(parsed.error.message);
  const body = parsed.data;
  const result = await dataManagementUseCases.startRestore(
    body.backupId,
    session.adminId ?? '',
    session.adminRole as AdminRole
  );

  return success(result);
});
