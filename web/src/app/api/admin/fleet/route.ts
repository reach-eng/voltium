import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
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
    // P0: bound the fleet export (use-case caps at 200/page).
    const page = Math.max(parseInt(url.searchParams.get('page') || '1', 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 200);

    const result = await adminRiderUseCases.listFleet({ hubId, status, search, lowBattery, page, limit });

    return withCacheHeaders(success(result), 5);
  } catch (error) {
    logger.error('GET /api/admin/fleet error:', error);
    return errors.internal('Failed to fetch fleet data');
  }
}
