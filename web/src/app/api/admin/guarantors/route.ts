import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
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
  const where: any = {};
  if (status && status !== 'ALL') where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search } },
      { rider: { fullName: { contains: search, mode: 'insensitive' } } },
      { rider: { riderId: { contains: search, mode: 'insensitive' } } },
    ];
  }
  const [records, total] = await Promise.all([
    guarantorRepository.findMany({ where, include: { rider: { select: { id: true, riderId: true, fullName: true, phone: true, lifecycleStatus: true } } }, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
    guarantorRepository.count({ where }),
  ]);
  return success({ records, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
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
  return success(result, `Guarantor ${String(action).toLowerCase()} processed`);
});
