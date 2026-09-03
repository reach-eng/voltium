import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { invalidateCache } from '@/lib/cache';

function normalizeValidUntil(val: string | Date): Date {
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return new Date(`${val}T23:59:59.999Z`);
  }
  return new Date(val);
}

export const couponUseCases = {
  async list(page: number, limit: number, search?: string | null) {
    // PR-9 (2026-08-06 fix plan): the admin coupons screen previously had
    // local-only search — the server never filtered. Filter by code/description.
    const where = search?.trim()
      ? {
          OR: [
            { code: { contains: search.trim(), mode: 'insensitive' as const } },
            {
              description: {
                contains: search.trim(),
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : undefined;
    const [rawCoupons, total] = await Promise.all([
      db.coupon.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.coupon.count({ where }),
    ]);
    const coupons = rawCoupons.map((c: Record<string, any>) => ({
      ...c,
      discountValue: c.discountType === 'FIXED' ? c.discountValueInPaise / 100 : c.discountValueInPaise,
      minAmount: c.minAmount ? c.minAmount / 100 : null,
    }));
    return { coupons, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async create(
    data: {
      code: string;
      description: string;
      discountType: string;
      discountValue: number;
      minAmount?: number;
      maxUses?: number;
      validFrom: string;
      validUntil: string;
      isActive: boolean;
    },
    actorId: string
  ) {
    const discountValueInPaise =
      data.discountType === 'FIXED' ? data.discountValue * 100 : data.discountValue;
    // P1: PERCENTAGE is a percent, not money — cap at 100 (schema also caps
    // when the type is explicit; this is the authoritative check).
    if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
      throw new Error('PERCENTAGE discountValue cannot exceed 100');
    }

    const coupon = await db.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        description: data.description,
        discountType: data.discountType as 'PERCENTAGE' | 'FIXED',
        discountValueInPaise,
        // P1: minAmount arrives in rupees (admin form) and list() displays
        // paise/100 — store paise (was stored raw, i.e. 100x off).
        minAmount: data.minAmount != null ? Math.round(data.minAmount * 100) : null,
        maxUses: data.maxUses ?? null,
        validFrom: new Date(data.validFrom),
        validUntil: normalizeValidUntil(data.validUntil),
        isActive: data.isActive,
      },
    });
    invalidateCache('admin:coupons:*');
    createAuditLog({
      actorId,
      action: 'coupon.create',
      entity: 'coupon',
      entityId: coupon.id,
      details: { code: coupon.code },
    }).catch((e) => logger.error('Audit log failed', e));
    return coupon;
  },

  async update(id: string, data: Record<string, unknown>, actorId: string) {
    const updateData = { ...data };
    if (updateData.validFrom) updateData.validFrom = new Date(updateData.validFrom as string);
    if (updateData.validUntil) updateData.validUntil = normalizeValidUntil(updateData.validUntil as string | Date);
    if (updateData.code) updateData.code = (updateData.code as string).toUpperCase();
    // PR-VER-2026-08-06 (SHIFTS P0-3): the old update only converted
    // `discountValue` when `discountType === 'FIXED'` — a PERCENTAGE update
    // kept `discountValue` in the payload and hit Prisma with a field that
    // doesn't exist. The create() path stores PERCENTAGE as-is (it is not a
    // paise value), so update must mirror that. When the admin edits only the
    // value (no type change), the existing coupon's type is authoritative.
    if (updateData.discountValue !== undefined) {
      let discountType = updateData.discountType as string | undefined;
      if (!discountType) {
        const existing = await db.coupon.findUnique({
          where: { id },
          select: { discountType: true },
        });
        discountType = existing?.discountType;
      }
      updateData.discountValueInPaise =
        discountType === 'FIXED'
          ? Number(updateData.discountValue) * 100
          : Number(updateData.discountValue);
      // P1: authoritative PERCENTAGE cap (update may carry value-only with
      // the existing coupon's type resolved above).
      if (discountType === 'PERCENTAGE' && Number(updateData.discountValue) > 100) {
        throw new Error('Percentage discount must be between 1 and 100');
      }
      delete updateData.discountValue;
    }
    // P1: minAmount arrives in rupees — store paise (see create()).
    if (updateData.minAmount !== undefined && updateData.minAmount !== null) {
      updateData.minAmount = Math.round(Number(updateData.minAmount) * 100);
    }
    const coupon = await db.coupon.update({ where: { id }, data: updateData });
    invalidateCache('admin:coupons:*');
    createAuditLog({
      actorId,
      action: 'coupon.update',
      entity: 'coupon',
      entityId: id,
      details: data,
    }).catch((e) => logger.error('Audit log failed', e));
    return coupon;
  },

  async delete(id: string, actorId: string) {
    await db.coupon.delete({ where: { id } });
    invalidateCache('admin:coupons:*');
    createAuditLog({ actorId, action: 'coupon.delete', entity: 'coupon', entityId: id }).catch(
      (e) => logger.error('Audit log failed', e)
    );
  },
};
