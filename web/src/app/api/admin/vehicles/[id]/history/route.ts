import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'vehicles_view')) return adminForbidden();

  try {
    const { id } = await context.params;
    const vehicle = await db.vehicle.findFirst({
      where: { OR: [{ id: id }, { vehicleId: id }, { vehicleNumber: id }] },
      include: {
        hub: true,
        leases: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: {
            rider: { select: { riderId: true, fullName: true, phone: true } },
            shift: true,
          },
        },
        returns: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { rider: { select: { riderId: true, fullName: true, phone: true } } },
        },
        incidents: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { rider: { select: { riderId: true, fullName: true, phone: true } } },
        },
        tickets: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { rider: { select: { riderId: true, fullName: true, phone: true } } },
        },
      },
    });
    if (!vehicle) return errors.notFound('Vehicle not found');

    return withCacheHeaders(
      success({
        vehicle,
        timeline: [
          ...vehicle.leases.map((item: any) => ({ type: 'lease', at: item.createdAt, item })),
          ...vehicle.returns.map((item: any) => ({ type: 'return', at: item.createdAt, item })),
          ...vehicle.incidents.map((item: any) => ({ type: 'incident', at: item.createdAt, item })),
          ...vehicle.tickets.map((item: any) => ({ type: 'ticket', at: item.createdAt, item })),
        ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
      }),
      30
    );
  } catch (error) {
    logger.error('[GET /api/admin/vehicles/[id]/history]', error);
    return errors.internal('Failed to fetch vehicle history');
  }
}
