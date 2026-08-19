import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { db } from '@/lib/db';
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

    return success(rider);
  }
);
