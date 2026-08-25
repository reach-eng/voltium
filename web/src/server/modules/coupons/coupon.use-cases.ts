import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { invalidateCache } from '@/lib/cache';
import { normalizeExpiryToEndOfDayUtc } from '@/lib/date-normalize';

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

    const coupon = await db.coupon.create({
      data: {
        code: data.code.toUpperCase(),
        description: data.description,
        discountType: data.discountType as 'PERCENTAGE' | 'FIXED',
        discountValueInPaise,
        minAmount: data.minAmount ?? null,
        maxUses: data.maxUses ?? null,
        // T-94 (PR-4, 2026-08-23) and Admin Panel Phase 3 P2-15: a
        // YYYY-MM-DD `validUntil` represents "valid through the
        // END of that day" (the operator's mental model), not
        // midnight at the START of that day. Normalize at the
        // use-case boundary so the DB row reflects the end-of-day
        // semantic, regardless of whether the admin typed
        // "2026-09-30" or "2026-09-30T23:59:59.999Z".
        validFrom: new Date(data.validFrom),
        validUntil: normalizeExpiryToEndOfDayUtc(data.validUntil),
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
    if (updateData.validUntil) {
      // T-94 + P2-15: same end-of-day normalization on update.
      updateData.validUntil = normalizeExpiryToEndOfDayUtc(
        updateData.validUntil as string
      );
    }
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
      // Admin Panel Phase 2 P1-13 (2026-08-23): percentage cap on
      // partial update. The create path enforces this via the
      // schema's superRefine, but the update path bypasses the
      // schema and writes directly to the DB. Apply the same
      // 1..100% rule here so a 150% edit can never persist.
      if (
        discountType === 'PERCENTAGE' &&
        (Number(updateData.discountValue) < 1 ||
          Number(updateData.discountValue) > 100)
      ) {
        throw new Error('Percentage discount must be between 1 and 100');
      }
      updateData.discountValueInPaise =
        discountType === 'FIXED'
          ? Number(updateData.discountValue) * 100
          : Number(updateData.discountValue);
      delete updateData.discountValue;
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
