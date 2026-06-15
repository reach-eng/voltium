import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';

export const couponUseCases = {
  async list(page: number, limit: number) {
    const [coupons, total] = await Promise.all([
      db.coupon.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      db.coupon.count(),
    ]);
    return { coupons, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async create(data: {
    code: string; description: string; discountType: string; discountValue: number;
    minAmount?: number; maxUses?: number; validFrom: string; validUntil: string; isActive: boolean;
  }, actorId: string) {
    const coupon = await db.coupon.create({
      data: {
        code: data.code.toUpperCase(), description: data.description, discountType: data.discountType,
        discountValue: data.discountValue, minAmount: data.minAmount ?? null, maxUses: data.maxUses ?? null,
        validFrom: new Date(data.validFrom), validUntil: new Date(data.validUntil), isActive: data.isActive,
      },
    });
    createAuditLog({ actorId, action: 'coupon.create', entity: 'coupon', entityId: coupon.id, details: { code: coupon.code } }).catch((e) => logger.error('Audit log failed', e));
    return coupon;
  },

  async update(id: string, data: Record<string, unknown>, actorId: string) {
    const updateData = { ...data };
    if (updateData.validFrom) updateData.validFrom = new Date(updateData.validFrom as string);
    if (updateData.validUntil) updateData.validUntil = new Date(updateData.validUntil as string);
    if (updateData.code) updateData.code = (updateData.code as string).toUpperCase();
    const coupon = await db.coupon.update({ where: { id }, data: updateData });
    createAuditLog({ actorId, action: 'coupon.update', entity: 'coupon', entityId: id, details: data }).catch((e) => logger.error('Audit log failed', e));
    return coupon;
  },

  async delete(id: string, actorId: string) {
    await db.coupon.delete({ where: { id } });
    createAuditLog({ actorId, action: 'coupon.delete', entity: 'coupon', entityId: id }).catch((e) => logger.error('Audit log failed', e));
  },
};
