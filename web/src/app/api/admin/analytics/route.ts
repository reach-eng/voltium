import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { analyticsUseCases } from '@/server/modules/analytics/analytics.use-cases';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'analytics_view')) return adminForbidden();

  try {
    const result = await analyticsUseCases.getOverview();
    return success(result);
  } catch (error) {
    logger.error('GET /api/admin/analytics error:', error);
    return errors.internal('Failed to fetch analytics');
  }
}
