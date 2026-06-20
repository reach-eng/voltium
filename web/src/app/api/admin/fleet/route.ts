import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'riders_view')) return adminForbidden();

  try {
    const url = req.nextUrl;
    const hubId = url.searchParams.get('hubId') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const search = url.searchParams.get('search') || undefined;
    const lowBattery = url.searchParams.get('lowBattery') === 'true';

    const result = await adminRiderUseCases.listFleet({ hubId, status, search, lowBattery });

    return success(result);
  } catch (error) {
    logger.error('GET /api/admin/fleet error:', error);
    return errors.internal('Failed to fetch fleet data');
  }
}
