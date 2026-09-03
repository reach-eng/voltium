import { Prisma, RentalStatus } from '@prisma/client';
import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { getOrSetResponse, invalidateCache } from '@/lib/cache';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission, type Permission } from '@/lib/auth';
import { parsePositiveInt } from '@/lib/api-utils';
import { validateBody, adminRentalActionSchema } from '@/lib/validators';
import { rentalRepository } from '@/server/modules/rentals/rental.repository';
import { withApiHandler } from '@/lib/api-handler';

export const GET = withApiHandler(async (request: NextRequest) => {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (
    !hasPermission(session.adminRole || '', 'rentals_pickup_inspection') &&
    !hasPermission(session.adminRole || '', 'rentals_return_inspection') &&
    !hasPermission(session.adminRole || '', 'riders_view')
  ) {
    return adminForbidden();
  }

  const url = request.nextUrl;
  const status = url.searchParams.get('status') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const page = parsePositiveInt(url.searchParams.get('page'), 1);
  const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 100);

  const where: Prisma.RentalLeaseWhereInput = {};
  if (status && status !== 'ALL' && status in RentalStatus) {
    where.status = status as RentalStatus;
  }
  if (search) {
    where.OR = [
      { rider: { fullName: { contains: search, mode: 'insensitive' } } },
      { rider: { riderId: { contains: search, mode: 'insensitive' } } },
      { vehicle: { vehicleId: { contains: search, mode: 'insensitive' } } },
      { vehicle: { vehicleNumber: { contains: search, mode: 'insensitive' } } },
    ];
  }

  // Rental list refreshes every 5s in the admin UI; cache the filtered query
  // at the route level (per-admin) so concurrent tab views dedup. The PUT
  // handler below invalidates the admin:* namespace on state transitions.
  const cacheKey = [
    'admin:rentals',
    session.adminId ?? 'anon',
    status ?? '',
    search ?? '',
    page,
    limit,
  ].join(':');

  const result = await getOrSetResponse(
    cacheKey,
    async () => {
      const [records, total] = await Promise.all([
        rentalRepository.findManyLeases({
          where,
          include: {
            rider: {
              select: { id: true, riderId: true, fullName: true, phone: true, lifecycleStatus: true },
            },
            vehicle: {
              select: { id: true, vehicleId: true, vehicleNumber: true, model: true, status: true },
            },
            shift: true,
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        rentalRepository.countLeases({ where }),
      ]);
      return {
        records,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    },
    5
  );

  return withCacheHeaders(success(result), 5);
});

export const PUT = withApiHandler(async (request: NextRequest) => {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();

  const body = await request.json().catch(() => ({}));
  const leaseId = body.leaseId || body.id;
  if (!leaseId || typeof body.action !== 'string') {
    return errors.badRequest('leaseId and action are required');
  }

  // P1.4: closed Zod enum — a typo'd action is a 400 here instead of being
  // silently bucketed into the wrong permission (the old code did
  // `String.includes('RETURN')`, so `RETURNX` passed the return gate).
  const validation = validateBody(
    adminRentalActionSchema,
    String(body.action).toUpperCase()
  );
  if (!validation.success) return errors.validation('Invalid rental action');
  const action = validation.data;

  const ACTION_PERMISSION_MAP: Record<string, Permission> = {
    START: 'rentals_pickup_inspection',
    PICKUP_COMPLETE: 'rentals_pickup_inspection',
    REQUEST_RETURN: 'rentals_return_inspection',
    APPROVE_RETURN: 'rentals_return_inspection',
    CLOSE: 'rentals_return_inspection',
    MARK_OVERDUE: 'rentals_pickup_inspection',
    SUSPEND: 'rentals_pickup_inspection',
  };
  const permission: Permission =
    ACTION_PERMISSION_MAP[action] || 'rentals_pickup_inspection';
  if (!hasPermission(session.adminRole || '', permission)) return adminForbidden();

  const lease = await rentalRepository.findLeaseById(leaseId);
  if (!lease) return errors.notFound('Rental lease not found');

  const result = await rentalRepository.executeLeaseAction(lease, action);
  // State transitions invalidate the rental list cache so the next GET reflects
  // the new status without waiting for the 5s TTL.
  invalidateCache('admin:rentals:*');
  return success(result, `Rental action ${action} completed`);
});
