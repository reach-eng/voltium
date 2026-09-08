import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { logDeviceDataAccess } from '@/lib/security-events';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();
    if (!hasPermission(session, 'device_tracking_view')) return adminForbidden();

    const { id: riderId } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    // SOC2: every admin read of a rider's device
    // data is recorded. The endpoint serves
    // location history, contacts, and call logs —
    // all PII — so the access log is required, not
    // optional. Fire-and-forget; failure does not
    // block the response. `type` records the data
    // category (locations, contacts, call-logs, or
    // 'all' for the default).
    void logDeviceDataAccess({
      adminId: session.adminId ?? session.riderDbId ?? 'unknown',
      riderId,
      dataType: type,
    });

    const results = await adminRiderUseCases.getDeviceData(riderId, type);
    return success(results);
  } catch (err) {
    logger.error('[GET /api/admin/riders/[id]/device-data]', err);
    return errors.internal('Failed to fetch device data');
  }
}
