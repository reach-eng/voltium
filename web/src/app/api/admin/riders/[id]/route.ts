import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { logKycDocumentView } from '@/lib/security-events';
import { withApiHandler } from '@/lib/api-handler';

export const GET = withApiHandler(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();
    if (!hasPermission(session.adminRole || '', 'riders_view')) return adminForbidden();

    const { id } = await params;
    if (!id) return errors.badRequest('Rider ID is required');

    const rider = await db.rider.findFirst({
      where: {
        OR: [{ id }, { riderId: id }],
      },
      include: {
        kycProfile: true,
        wallet: true,
        guarantor: true,
        leases: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { vehicle: true },
        },
      },
    });

    if (!rider) return errors.notFound('Rider not found');

    // NET-005 follow-up-9 (2026-09-08): single-rider
    // detail view returns the full kycProfile (all doc
    // URLs) via the `include`. SOC2 requires that every
    // admin access to a rider's KYC data be recorded. The
    // dead `findByRiderIdForAdmin` was never wired up; we
    // fire the log here instead, one per request. Skipped
    // when the rider has no kycProfile row (PENDING-only
    // would log a no-op view). documentType=`rider_detail`
    // distinguishes this from the list and queue views.
    if (rider.kycProfile) {
      void logKycDocumentView({
        adminId: session.adminId ?? session.riderDbId ?? 'unknown',
        riderId: rider.id,
        documentType: 'rider_detail',
      });
    }

    return success(rider);
  }
);
