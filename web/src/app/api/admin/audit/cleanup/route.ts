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
    const action = req.nextUrl.searchParams.get('action');

    if (action === 'cleanup') {
      const deletedCount = await deleteExpiredLogs();
      return success({ deleted: deletedCount }, 'Expired audit logs cleaned up');
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
