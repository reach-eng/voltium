import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
// T-94 + P2-15 (2026-08-23): same end-of-day normalization as
// coupons — a YYYY-MM-DD `validUntil` is the operator's
// "valid through the END of that day", not midnight at the
// start. See lib/date-normalize.ts for the contract.
import { normalizeExpiryToEndOfDayUtc } from '@/lib/date-normalize';
// Admin Panel Phase 4 / Batch C (2026-08-23): offer mutations must
// invalidate `admin:offers:*` so the admin list screen picks up
// create / update / delete on the next read. The cache is keyed
// `admin:offers:${query-hash}` for list results, so we use the
// pattern wildcard. This matches the same invalidation contract
// already used by the coupons, riders, and vehicles modules.
import { invalidateCache } from '@/lib/cache';

export const offerUseCases = {
  async listAdmin(page: number, limit: number, search?: string | null) {
    // PR-9 (2026-08-06 fix plan): server-side search on the offers screen.
    const where = search?.trim()
      ? {
          OR: [
            { title: { contains: search.trim(), mode: 'insensitive' as const } },
            {
              description: {
                contains: search.trim(),
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : undefined;
    const [offers, total] = await Promise.all([
      db.offer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.offer.count({ where }),
    ]);
    return { offers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async create(
    data: {
      title: string;
      description?: string;
      validFrom: string;
      validUntil: string;
      isSponsored: boolean;
      isActive: boolean;
      icon?: string;
    },
    actorId: string
  ) {
    const offer = await db.offer.create({
      data: {
        title: data.title,
        description: data.description || '',
        validFrom: new Date(data.validFrom),
        validUntil: normalizeExpiryToEndOfDayUtc(data.validUntil),
        isSponsored: data.isSponsored,
        isActive: data.isActive,
        icon: data.icon ?? null,
      },
    });
    invalidateCache('admin:offers:*');
    createAuditLog({
      actorId,
      action: 'offer.create',
      entity: 'offer',
      entityId: offer.id,
      details: { title: data.title },
    }).catch((e) => logger.error('Audit log failed', e));
    return offer;
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
    const offer = await db.offer.update({ where: { id }, data: updateData });
    invalidateCache('admin:offers:*');
    createAuditLog({
      actorId,
      action: 'offer.update',
      entity: 'offer',
      entityId: id,
      details: data,
    }).catch((e) => logger.error('Audit log failed', e));
    return offer;
  },

  async delete(id: string, actorId: string) {
    await db.offer.delete({ where: { id } });
    invalidateCache('admin:offers:*');
    createAuditLog({ actorId, action: 'offer.delete', entity: 'offer', entityId: id }).catch((e) =>
      logger.error('Audit log failed', e)
    );
  },

  async getActiveSponsored() {
    const now = new Date();
    return db.offer.findMany({
      where: { isActive: true, isSponsored: true, validUntil: { gte: now } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },
};
