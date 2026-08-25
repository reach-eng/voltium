import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { validateBody, createCouponSchema, updateCouponSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { parsePositiveInt } from '@/lib/api-utils';
import { hasPermission } from '@/lib/auth';
import { couponUseCases } from '@/server/modules/coupons/coupon.use-cases';
import { logAdminMutation } from '@/lib/audit-log';

const deleteCouponSchema = z.object({ id: z.string().min(1) });

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'offers_manage')) return adminForbidden();

  try {
    // DEEP-AUDIT D-P1-1: parsePositiveInt (NaN-safe) replaces the removed
    // parsePaginationParams helper.
    const page = parsePositiveInt(req.nextUrl.searchParams.get('page'), 1);
    const limit = parsePositiveInt(req.nextUrl.searchParams.get('limit'), 20, 100);
    const search = req.nextUrl.searchParams.get('search');
    const result = await couponUseCases.list(page, limit, search);
    return withCacheHeaders(success(result.coupons, undefined, 200, result.pagination), 60);
  } catch (error) {
    logger.error('GET /api/admin/coupons error:', error);
    return errors.internal('Failed to fetch coupons');
  }
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'offers_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(createCouponSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const coupon = await couponUseCases.create(validation.data, session.adminId || '');

    await logAdminMutation({
      session,
      action: 'coupon.create',
      entity: 'Coupon',
      entityId: coupon?.id,
      details: { code: validation.data.code },
    });

    return success(coupon, 'Coupon created', 201);
  } catch (error: unknown) {
    const err = error as { code?: string };
    logger.error('POST /api/admin/coupons error:', error);
    if (err.code === 'P2002') return errors.conflict('Coupon code already exists');
    return errors.internal('Failed to create coupon');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'offers_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(updateCouponSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    const { id, ...data } = validation.data;
    const coupon = await couponUseCases.update(id, data, session.adminId || '');

    await logAdminMutation({
      session,
      action: 'coupon.update',
      entity: 'Coupon',
      entityId: id,
      details: data,
    });

    return success(coupon);
  } catch (error: unknown) {
    const err = error as { code?: string };
    logger.error('PUT /api/admin/coupons error:', error);
    if (err.code === 'P2002') return errors.conflict('Coupon code already exists');
    return errors.internal('Failed to update coupon');
  }
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'offers_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(deleteCouponSchema, body);
    if (!validation.success) return errors.validation(validation.error!);

    await couponUseCases.delete(validation.data.id, session.adminId || '');

    await logAdminMutation({
      session,
      action: 'coupon.delete',
      entity: 'Coupon',
      entityId: validation.data.id,
    });

    return success(null, 'Coupon deleted');
  } catch (error) {
    logger.error('DELETE /api/admin/coupons error:', error);
    return errors.internal('Failed to delete coupon');
  }
}
