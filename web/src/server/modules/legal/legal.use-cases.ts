import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';

export const legalUseCases = {
  async list() {
    return db.legalDocument.findMany({ orderBy: { type: 'asc' } });
  },

  async upsert(data: { type: string; title?: string; content: string }, actorId: string) {
    const doc = await db.legalDocument.upsert({
      where: { type: data.type },
      update: { title: data.title || data.type, content: data.content },
      create: { type: data.type, title: data.title || data.type, content: data.content },
    });
    createAuditLog({ actorId, action: 'legal.update', entity: 'legal', entityId: doc.id, details: { type: doc.type } }).catch(() => {});
    return doc;
  },
};
