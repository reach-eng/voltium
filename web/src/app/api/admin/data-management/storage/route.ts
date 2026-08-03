import { getAdminSession } from '@/lib/get-session';
import { dataManagementUseCases } from '@/server/modules/data-management/data-management.use-cases';
import type { AdminRole } from '@/server/modules/admin/admin.types';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';

// PR-90 (API N12): envelope consistency. Was using raw
// `NextResponse.json({success:true,data})`; now uses the shared
// `success()` / `errors.*()` helpers from `@/lib/api-response`.

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return errors.unauthorized('Unauthorized');
    }

    const storage = await dataManagementUseCases.getStorage(session.adminRole as AdminRole);
    return success(storage);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return errors.forbidden('Forbidden: insufficient role for backup storage view');
    }
    logger.error('[admin/data-management/storage] failed', err);
    return errors.internal('Internal error');
  }
}
