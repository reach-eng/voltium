import { NextRequest } from 'next/server';
import { requireAdminSession, AdminAuthError, AdminForbiddenError } from '@/server/modules/admin/admin.policy';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { getOrSetResponse } from '@/lib/cache';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession(req, 'ops_read');

    const isRealtime = req.nextUrl.searchParams.get('realtime') === 'true';

    const fetchStats = async () => {
      const [activeRentals, pendingKyc, pendingDeposits, availableVehicles, openTickets] =
        await Promise.all([
          db.rentalLease.count({ where: { status: 'ACTIVE' } }),
          db.kycProfile.count({ where: { status: { in: ['PENDING', 'SUBMITTED'] } } }),
          db.depositRecord.count({ where: { status: { in: ['PENDING', 'PENDING_VERIFICATION'] } } }),
          db.vehicle.count({ where: { status: 'AVAILABLE' } }),
          db.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        ]);

      return {
        activeRentals,
        pendingKyc,
        pendingDeposits,
        availableVehicles,
        openTickets,
      };
    };

    const stats = isRealtime
      ? await fetchStats()
      : await getOrSetResponse('admin:operations:overview', fetchStats, 30);

    return withCacheHeaders(success(stats), isRealtime ? 0 : 30);
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return errors.unauthorized(err.message);
    }
    if (err instanceof AdminForbiddenError) {
      return errors.forbidden(err.message);
    }
    // P1: generic 500 (raw DB text must not reach the client; logged below).
    logger.error('GET /api/admin/operations/overview error:', err);
    return errors.internal('Failed to fetch operations overview');
  }
}
