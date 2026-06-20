import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();
    if (!hasPermission(session, 'device_tracking_view')) return adminForbidden();

    const { id: riderId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    const results = await adminRiderUseCases.getDeviceData(riderId, type);
    return success(results);
  } catch (err) {
    logger.error('[GET /api/admin/riders/[id]/device-data]', err);
    return errors.internal('Failed to fetch device data');
  }
}
