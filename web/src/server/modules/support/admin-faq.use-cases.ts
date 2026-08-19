import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/audit-log';
import { sanitizeHtml } from '@/lib/sanitize';

export const adminFaqUseCases = {
  async list(params: { search?: string; category?: string; isActive?: boolean; page?: number; limit?: number }) {
    const { search, category, isActive, page = 1, limit = 20 } = params;
    const where: Prisma.FaqWhereInput = { deletedAt: null };
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [faqs, total] = await Promise.all([
      db.faq.findMany({ where, orderBy: { order: 'asc' }, skip: (page - 1) * limit, take: limit }),
      db.faq.count({ where }),
    ]);
    return { faqs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async getNextOrder() {
    const maxFaq = await db.faq.findFirst({
      where: { deletedAt: null },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    return (maxFaq?.order ?? -1) + 1;
  },

  async create(
    data: { question: string; answer: string; category?: string; order?: number; isActive: boolean },
    actorId: string
  ) {
    const order = data.order !== undefined ? data.order : await this.getNextOrder();
    const faq = await db.faq.create({
      data: {
        question: sanitizeHtml(data.question),
        answer: sanitizeHtml(data.answer),
        category: data.category || null,
        order,
        isActive: data.isActive,
      },
    });
    createAuditLog({
      actorId,
      action: 'faq.create',
      entity: 'faq',
      entityId: faq.id,
      details: { question: faq.question },
    }).catch(() => {});
    return faq;
  },

  async update(id: string, data: Record<string, unknown>, actorId: string) {
    const faq = await db.faq.update({
      where: { id },
      data: {
        ...data,
        ...(data.question ? { question: sanitizeHtml(data.question as string) } : {}),
        ...(data.answer ? { answer: sanitizeHtml(data.answer as string) } : {}),
      },
    });
    createAuditLog({
      actorId,
      action: 'faq.update',
      entity: 'faq',
      entityId: faq.id,
      details: { question: faq.question },
    }).catch(() => {});
    return faq;
  },

  async reorder(id: string, direction: 'up' | 'down', actorId: string) {
    const allFaqs = await db.faq.findMany({
      where: { deletedAt: null },
      orderBy: { order: 'asc' },
    });

    const index = allFaqs.findIndex((f: { id: string }) => f.id === id);
    if (index === -1) throw new Error('FAQ not found');

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= allFaqs.length) return allFaqs;

    const currentFaq = allFaqs[index];
    const targetFaq = allFaqs[targetIndex];

    await db.$transaction([
      db.faq.update({ where: { id: currentFaq.id }, data: { order: targetFaq.order } }),
      db.faq.update({ where: { id: targetFaq.id }, data: { order: currentFaq.order } }),
    ]);

    createAuditLog({
      actorId,
      action: 'faq.reorder',
      entity: 'faq',
      entityId: id,
      details: { direction, swappedWith: targetFaq.id },
    }).catch(() => {});

    return this.list({ page: 1, limit: 100 });
  },

  async delete(id: string, actorId: string) {
    const existing = await db.faq.findUnique({ where: { id } });
    if (!existing) throw new Error('FAQ not found');

    await db.faq.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    createAuditLog({
      actorId,
      action: 'faq.delete',
      entity: 'faq',
      entityId: id,
      details: { question: existing.question, answer: existing.answer },
    }).catch(() => {});
  },
};
