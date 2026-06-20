import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized } from '@/lib/rbac';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  try {
    const url = req.nextUrl;
    const actorId = url.searchParams.get('actorId') || undefined;
    const action = url.searchParams.get('action') || undefined;
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '50')), 100);

    const result = await adminUseCases.getAuditLogs({ actorId, action, page, limit });

    return success(result.logs, undefined, 200, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (error) {
    logger.error('[AUDIT_LOGS_GET]', error);
    return errors.internal('Failed to fetch audit logs');
  }
}
