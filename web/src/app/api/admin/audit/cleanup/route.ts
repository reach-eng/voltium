import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { deleteExpiredLogs, getRetentionStats } from '@/lib/audit-log';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'settings_manage')) return adminForbidden();

  try {
    // P1: GET is read-only. The old `?action=cleanup` branch let crawlers /
    // prefetch (with an admin cookie) wipe the audit trail. Mutations live on
    // POST only; ?action=cleanup now returns 410 with a pointer to POST.
    const action = req.nextUrl.searchParams.get('action');

    if (action === 'cleanup') {
      return errors.gone('Use POST /api/admin/audit/cleanup to run cleanup');
    }

    const stats = await getRetentionStats();
    return success(stats, 'Retention stats retrieved');
  } catch (error) {
    logger.error('[AUDIT_CLEANUP_GET]', error);
    return errors.internal('Failed to process audit cleanup request');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'settings_manage')) return adminForbidden();

  try {
    const deletedCount = await deleteExpiredLogs();
    return success({ deleted: deletedCount }, 'Expired audit logs cleaned up');
  } catch (error) {
    logger.error('[AUDIT_CLEANUP_POST]', error);
    return errors.internal('Failed to run audit cleanup');
  }
}
