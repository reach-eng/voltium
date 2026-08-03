import { getAdminSession } from '@/lib/get-session';
import { dataManagementUseCases } from '@/server/modules/data-management/data-management.use-cases';
import type { AdminRole } from '@/server/modules/admin/admin.types';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';

// PR-90 (API N12): envelope consistency. Was using raw
// `NextResponse.json({success:true,data})` and
// `NextResponse.json({error: err.message})`; now uses the shared
// `success()` / `errors.*()` envelope. 500 body is generic with the
// real cause logged.

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return errors.unauthorized('Unauthorized');

    const result = await dataManagementUseCases.getRestoreHistory(session.adminRole as AdminRole);
    return success(result);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'Unauthorized') {
      return errors.forbidden('Forbidden: insufficient role to view restore history');
    }
    logger.error('[admin/data-management/restore/history] GET failed', err);
    return errors.internal('Internal error');
  }
}
