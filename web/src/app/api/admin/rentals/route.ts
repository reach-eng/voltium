import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { rentalRepository } from '@/server/modules/rentals/rental.repository';
import { withApiHandler } from '@/lib/api-handler';

export const GET = withApiHandler(async (request: NextRequest) => {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'riders_view')) return adminForbidden();

  const url = request.nextUrl;
  const status = url.searchParams.get('status') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)), 100);

  const where: any = {};
  if (status && status !== 'ALL') where.status = status;
  if (search) {
    where.OR = [
      { rider: { fullName: { contains: search, mode: 'insensitive' } } },
      { rider: { riderId: { contains: search, mode: 'insensitive' } } },
      { vehicle: { vehicleId: { contains: search, mode: 'insensitive' } } },
      { vehicle: { vehicleNumber: { contains: search, mode: 'insensitive' } } },
    ];
  }

  const [records, total] = await Promise.all([
    rentalRepository.findManyLeases({
      where,
      include: {
        rider: { select: { id: true, riderId: true, fullName: true, phone: true, lifecycleStatus: true } },
        vehicle: { select: { id: true, vehicleId: true, vehicleNumber: true, model: true, status: true } },
        shift: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    rentalRepository.countLeases({ where }),
  ]);

  return success({ records, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
});

export const PUT = withApiHandler(async (request: NextRequest) => {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '').toUpperCase();
  const leaseId = body.leaseId || body.id;
  if (!leaseId || !action) return errors.badRequest('leaseId and action are required');

  const permission = action.includes('RETURN') || action === 'CLOSE' ? 'rentals_return_inspection' : 'rentals_pickup_inspection';
  if (!hasPermission(session.adminRole || '', permission as any)) return adminForbidden();

  const lease = await rentalRepository.findLeaseById(leaseId);
  if (!lease) return errors.notFound('Rental lease not found');

  const result = await rentalRepository.executeLeaseAction(lease, action);
  return success(result, `Rental action ${action} completed`);
});
