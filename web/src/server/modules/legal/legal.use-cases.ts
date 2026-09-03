import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { LEGAL_DOCUMENT_TYPES } from '@/lib/validators/admin';

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function defaultTitle(type: string): string {
  return LEGAL_DOCUMENT_TYPES.find((d) => d.key === type)?.label || type;
}

export const legalUseCases = {
  // P2-1: only 4 document types exist today (terms/privacy/refund/lease) so
  // an unfiltered findMany is fine; if the model grows, add type filtering +
  // pagination here rather than returning every row.
  async list() {
    return db.legalDocument.findMany({ orderBy: { type: 'asc' } });
  },

  async upsert(data: { type: string; title?: string; content?: string; isActive?: boolean }, actorId: string) {
    const title = data.title || defaultTitle(data.type);
    const hasContent = typeof data.content === 'string';
    const hash = hasContent ? contentHash(data.content!) : '';

    const updateData: Record<string, any> = {};
    if (data.title !== undefined) updateData.title = title;
    if (hasContent) updateData.content = data.content;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const createData: Record<string, any> = {
      type: data.type,
      title,
      content: data.content ?? '',
      isActive: data.isActive ?? true,
    };

    const doc = await db.$transaction(async (tx) => {
      const saved = await tx.legalDocument.upsert({
        where: { type: data.type },
        update: updateData,
        create: createData as any,
      });
      if (hasContent) {
        const latest = await tx.legalDocumentRevision.findFirst({
          where: { legalDocumentId: saved.id },
          orderBy: { createdAt: 'desc' },
          select: { contentHash: true },
        });
        if (latest?.contentHash !== hash) {
          await tx.legalDocumentRevision.create({
            data: {
              legalDocumentId: saved.id,
              title,
              content: data.content!,
              contentHash: hash,
              createdBy: actorId,
            },
          });
        }
      }
      return saved;
    });

    // Never swallow audit failures silently — log so operators can see the
    // trail is degrading (2026-08-05 legal/device audit P1-2; same pattern
    // flagged as P1-14/15 in the financial audit).
    createAuditLog({
      actorId,
      action: 'legal.update',
      entity: 'legal',
      entityId: doc.id,
      details: {
        type: doc.type,
        title,
        contentHash: hash,
      },
    }).catch(() => {
      logger.error('legal.update audit log write failed', {
        entityId: doc.id,
        type: doc.type,
      });
    });
    return doc;
  },
};
