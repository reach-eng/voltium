import { KycStatus, Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { kycRepository } from '@/server/modules/kyc/kyc.repository';
import { kycUseCases } from '@/server/modules/kyc/kyc.use-cases';
import { withApiHandler } from '@/lib/api-handler';

export const GET = withApiHandler(async (request: NextRequest) => {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'kyc_view')) return adminForbidden();

  const url = request.nextUrl;
  const status = url.searchParams.get('status') || undefined;
  const search = url.searchParams.get('search') || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)), 100);

  const where: Prisma.KycProfileWhereInput = {};
  if (status && status !== 'ALL' && status in KycStatus) {
    where.status = status as KycStatus;
  }
  if (search) {
    where.rider = {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' } },
        { riderId: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ],
    };
  }

  const [records, total] = await Promise.all([
    kycRepository.findMany({
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
    kycRepository.count({ where }),
  ]);

  return success({
    records,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'kyc_approve')) return adminForbidden();

  const body = await request.json();
  const riderId = body.riderId || body.riderDbId;
  const action = String(body.action || body.decision || '').toUpperCase();
  if (!riderId || !action) return errors.badRequest('riderId and action are required');

  const result = await kycUseCases.reviewKyc(riderId, session.adminId || '', {
    reviewerId: session.adminId || '',
    action: action as any,
    rejectionReason: body.rejectionReason || body.reason,
    infoRequest: body.infoRequest || body.message,
    editableFields: body.editableFields,
  });

  return success(result, `KYC ${String(action).toLowerCase()} processed`);
});
