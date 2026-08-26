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

  // W9 / L-1: rider-facing reads see PUBLISHED rows only. A document
  // saved-but-not-yet-published (status DRAFT) must never reach riders.
  async listPublished() {
    return db.legalDocument.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { type: 'asc' },
    });
  },

  async upsert(data: { type: string; title?: string; content: string }, actorId: string) {
    const title = data.title || defaultTitle(data.type);
    const hash = contentHash(data.content);

    // W9 / L-1: DRAFT/PUBLISHED lifecycle. A save that CHANGES content on
    // an existing document produces unreviewed text — it drops the doc to
    // DRAFT until an admin explicitly publishes. Byte-identical saves are
    // true no-ops (no revision noise, no status churn). Brand-new
    // documents start as DRAFT.
    const existing = await db.legalDocument.findUnique({ where: { type: data.type } });

    if (
      existing &&
      existing.title === title &&
      contentHash(existing.content) === hash
    ) {
      return existing; // true no-op save
    }

    // Both changed-existing and brand-new documents start as DRAFT —
    // nothing reaches riders until an admin publishes.
    const nextStatus = 'DRAFT' as const;

    const doc = await db.$transaction(async (tx) => {
      const saved = await tx.legalDocument.upsert({
        where: { type: data.type },
        update: { title, content: data.content, status: nextStatus },
        create: { type: data.type, title, content: data.content, status: nextStatus },
      });
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
            content: data.content,
            contentHash: hash,
            createdBy: actorId,
          },
        });
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

  /**
   * L-1b / W9 / L-1: explicit go-live action. Flips DRAFT → PUBLISHED and stamps
   * publishedAt. The rider surface (`listPublished`) serves only
   * PUBLISHED rows, so this is the single gate between an edit and
   * riders.
   *
   * Permission: `legal_publish` (SUPER_ADMIN only by default). Callers must
   * verify this permission before invoking — the publish route enforces it
   * via `hasPermission(session, 'legal_publish')`. Editors who hold only
   * `legal_manage` (OPERATIONS_ADMIN) can save to DRAFT but cannot call this.
   */
  async publish(type: string, actorId: string) {
    const doc = await db.legalDocument.findUnique({ where: { type } });
    if (!doc) {
      throw new Error(`Legal document not found: ${type}`);
    }
    if (doc.status === 'PUBLISHED' && doc.publishedAt) {
      return doc; // idempotent publish
    }
    const published = await db.legalDocument.update({
      where: { type },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    createAuditLog({
      actorId,
      action: 'legal.publish',
      entity: 'legal',
      entityId: published.id,
      details: {
        type,
        title: published.title,
        contentHash: contentHash(published.content),
      },
    }).catch(() => {
      logger.error('legal.publish audit log write failed', {
        entityId: published.id,
        type,
      });
    });

    return published;
  },

  /**
   * W9 / L-1: revision history is now REACHABLE. The revisions were
   * written on every save but no admin surface could list or restore
   * them — dead compliance data. These two use-cases back the new
   * `/api/admin/legal/[type]/revisions` endpoints.
   *
   * Deferred (needs a Prisma migration): DRAFT/PUBLISHED lifecycle so
   * saves stop going live instantly. Restore is the mitigation until
   * then — a bad save is one click from reversal.
   */
  async listRevisions(type: string, limit = 50) {
    const doc = await db.legalDocument.findUnique({ where: { type } });
    if (!doc) return null;
    const capped = Math.min(Math.max(limit, 1), 100);
    return db.legalDocumentRevision.findMany({
      where: { legalDocumentId: doc.id },
      orderBy: { createdAt: 'desc' },
      take: capped,
      select: {
        id: true,
        title: true,
        contentHash: true,
        createdBy: true,
        createdAt: true,
      },
    });
  },

  async restoreRevision(
    type: string,
    revisionId: string,
    actorId: string
  ) {
    const doc = await db.legalDocument.findUnique({ where: { type } });
    if (!doc) {
      throw new Error(`Legal document not found: ${type}`);
    }
    const revision = await db.legalDocumentRevision.findFirst({
      where: { id: revisionId, legalDocumentId: doc.id },
    });
    if (!revision) {
      throw new Error('Revision not found for this document');
    }

    // Reuse upsert so the restore itself is snapshotted as the newest
    // revision — history stays linear and forward-rollback remains
    // possible.
    const restored = await this.upsert(
      { type, title: revision.title, content: revision.content },
      actorId
    );

    createAuditLog({
      actorId,
      action: 'legal.restore_revision',
      entity: 'legal',
      entityId: restored.id,
      details: {
        type,
        revisionId,
        restoredContentHash: revision.contentHash,
      },
    }).catch(() => {
      logger.error('legal.restore_revision audit log write failed', {
        entityId: restored.id,
        type,
        revisionId,
      });
    });

    return restored;
  },
};
