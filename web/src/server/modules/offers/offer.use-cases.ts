import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';

export const offerUseCases = {
  async listAdmin(page: number, limit: number) {
    const [offers, total] = await Promise.all([
      db.offer.findMany({ orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      db.offer.count(),
    ]);
    return { offers, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async create(data: {
    title: string; description?: string; validFrom: string; validUntil: string;
    isSponsored: boolean; isActive: boolean; icon?: string;
  }, actorId: string) {
    const offer = await db.offer.create({
      data: { title: data.title, description: data.description || '', validFrom: new Date(data.validFrom), validUntil: new Date(data.validUntil), isSponsored: data.isSponsored, isActive: data.isActive, icon: data.icon ?? null },
    });
    createAuditLog({ actorId, action: 'offer.create', entity: 'offer', entityId: offer.id, details: { title: data.title } }).catch((e) => logger.error('Audit log failed', e));
    return offer;
  },

  async update(id: string, data: Record<string, unknown>, actorId: string) {
    const updateData = { ...data };
    if (updateData.validFrom) updateData.validFrom = new Date(updateData.validFrom as string);
    if (updateData.validUntil) updateData.validUntil = new Date(updateData.validUntil as string);
    const offer = await db.offer.update({ where: { id }, data: updateData });
    createAuditLog({ actorId, action: 'offer.update', entity: 'offer', entityId: id, details: data }).catch((e) => logger.error('Audit log failed', e));
    return offer;
  },

  async delete(id: string, actorId: string) {
    await db.offer.delete({ where: { id } });
    createAuditLog({ actorId, action: 'offer.delete', entity: 'offer', entityId: id }).catch((e) => logger.error('Audit log failed', e));
  },

  async getActiveSponsored() {
    const now = new Date();
    return db.offer.findMany({ where: { isActive: true, isSponsored: true, validUntil: { gte: now } }, orderBy: { createdAt: 'desc' } });
  },
};
