import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';

export const adminFaqUseCases = {
  async list(params: { search?: string; category?: string; page?: number; limit?: number }) {
    const { search, category, page = 1, limit = 20 } = params;
    const where: any = {};
    if (category) where.category = category;
    if (search) where.OR = [{ question: { contains: search } }, { answer: { contains: search } }];

    const [faqs, total] = await Promise.all([
      db.faq.findMany({ where, orderBy: { order: 'asc' }, skip: (page - 1) * limit, take: limit }),
      db.faq.count({ where }),
    ]);
    return { faqs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async create(data: { question: string; answer: string; category?: string; order: number; isActive: boolean }, actorId: string) {
    const faq = await db.faq.create({ data: { question: data.question, answer: data.answer, category: data.category || null, order: data.order, isActive: data.isActive } });
    createAuditLog({ actorId, action: 'faq.create', entity: 'faq', entityId: faq.id, details: { question: faq.question } }).catch(() => {});
    return faq;
  },

  async update(id: string, data: Record<string, unknown>, actorId: string) {
    const faq = await db.faq.update({ where: { id }, data });
    createAuditLog({ actorId, action: 'faq.update', entity: 'faq', entityId: faq.id, details: { question: faq.question } }).catch(() => {});
    return faq;
  },

  async delete(id: string, actorId: string) {
    await db.faq.delete({ where: { id } });
    createAuditLog({ actorId, action: 'faq.delete', entity: 'faq', entityId: id, details: { id } }).catch(() => {});
  },
};
