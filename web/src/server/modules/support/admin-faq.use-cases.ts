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
      // Tiebreak on createdAt so FAQs that share an `order` value (a
      // legacy data condition from the old bulk-import flow) still
      // have a deterministic sequence. The previous code sorted by
      // `order` alone; two FAQs with the same `order` would render
      // in undefined order, and the swap math could pick the wrong
      // neighbour.
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    const index = allFaqs.findIndex((f: { id: string }) => f.id === id);
    if (index === -1) throw new Error('FAQ not found');

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= allFaqs.length) return allFaqs;

    // P3-07 (FAQ Reordering Sequential Indexing, 2026-08-23): the
    // old code only swapped the two affected rows, leaving any
    // pre-existing duplicate `order` values intact. With a stale
    // dataset (3 FAQs all at `order: 0`), this produced an
    // ambiguous post-reorder state. The fix: splice the moved FAQ
    // into its new position, then re-number EVERY row 0..N-1
    // sequentially. A single transactional batch of N updates is
    // emitted; callers see the new order on the next read.
    const moved = allFaqs.splice(index, 1)[0];
    allFaqs.splice(targetIndex, 0, moved);

    const updates = allFaqs.map((faq, newOrder) =>
      db.faq.update({ where: { id: faq.id }, data: { order: newOrder } })
    );
    await db.$transaction(updates);

    createAuditLog({
      actorId,
      action: 'faq.reorder',
      entity: 'faq',
      entityId: id,
      details: { direction, swappedWith: allFaqs[targetIndex === 0 ? 1 : targetIndex - 1]?.id },
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
