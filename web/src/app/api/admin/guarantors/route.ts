import { GuarantorStatus, Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { getOrSetResponse, invalidateCache } from '@/lib/cache';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { guarantorRepository } from '@/server/modules/guarantors/guarantor.repository';
import { guarantorUseCases } from '@/server/modules/guarantors/guarantor.use-cases';
import { logger } from '@/lib/logger';
import { withApiHandler } from '@/lib/api-handler';

export const GET = withApiHandler(async (request: NextRequest) => {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'guarantor_view_limited')) return adminForbidden();

  const url = request.nextUrl;
  const status = url.searchParams.get('status') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)), 100);
  const where: Prisma.GuarantorWhereInput = {};
  if (status && status !== 'ALL' && status in GuarantorStatus) {
    where.status = status as GuarantorStatus;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { rider: { fullName: { contains: search, mode: 'insensitive' } } },
      { rider: { riderId: { contains: search, mode: 'insensitive' } } },
    ];
  }

  // Guarantor review queue — 5s route cache with per-admin + per-filter key.
  // POST handler below invalidates the admin:guarantors:* namespace.
  const cacheKey = [
    'admin:guarantors',
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
        guarantorRepository.findMany({
          where,
          include: {
            rider: {
              select: { id: true, riderId: true, fullName: true, phone: true, lifecycleStatus: true },
            },
          },
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        guarantorRepository.count({ where }),
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

export const POST = withApiHandler(async (request: NextRequest) => {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'kyc_approve')) return adminForbidden();

  const body = await request.json();
  const riderId = body.riderId || body.riderDbId;
  const action = String(body.action || body.decision || '').toUpperCase();
  if (!riderId || !action) return errors.badRequest('riderId and action are required');
  const result = await guarantorUseCases.reviewGuarantor(riderId, session.adminId || '', {
    reviewerId: session.adminId || '',
    action: action as any,
    rejectionReason: body.rejectionReason || body.reason,
    infoRequest: body.infoRequest || body.message,
  });
  // Approve / reject changes the queue — clear cached lists.
  invalidateCache('admin:guarantors:*');
  return success(result, `Guarantor ${String(action).toLowerCase()} processed`);
});
