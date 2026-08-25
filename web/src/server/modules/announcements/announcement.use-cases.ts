import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { sanitizeHtml } from '@/lib/sanitize';
import { logger } from '@/lib/logger';
import { AnnouncementStatus, RiderLifecycleStatus, Prisma } from '@prisma/client';
import { OutboxService, OutboxEventTypes, emitWithCommit } from '@/server/workers/outbox';

/**
 * Resolve the recipient COUNT for an announcement audience without loading
 * the ids (used by the create path, which only needs the count for
 * totalRecipients + audit — keeps the request light at 10k+ riders).
 */
async function resolveRecipientCount(
  targetAudience: string,
  targetIds: string[]
): Promise<number> {
  if (targetAudience === 'ALL') {
    return db.rider.count();
  }
  if (targetAudience === 'BY_HUB') {
    return db.rider.count({ where: { pickupHub: { in: targetIds } } });
  }
  if (targetAudience === 'BY_STATUS') {
    return db.rider.count({ where: { lifecycleStatus: { in: targetIds as RiderLifecycleStatus[] } } });
  }
  if (targetAudience === 'BY_PLAN') {
    return db.rider.count({ where: { currentPlan: { in: targetIds } } });
  }
  return 0;
}

export const announcementUseCases = {
  async list(params: { status?: string; search?: string; page?: number; limit?: number }) {
    const { status, search, page = 1, limit = 20 } = params;
    const where: Prisma.AnnouncementWhereInput = {};
    if (status) where.status = status as AnnouncementStatus;
    if (search) where.OR = [{ title: { contains: search } }, { message: { contains: search } }];

    const [announcements, total] = await Promise.all([
      db.announcement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { deliveries: { select: { status: true } } },
      }),
      db.announcement.count({ where }),
    ]);

    const formatted = announcements.map((a) => {
      const delivered = a.deliveries?.filter((d) => d.status === 'DELIVERED').length || 0;
      const read = a.deliveries?.filter((d) => d.status === 'READ').length || 0;
      const failed = a.deliveries?.filter((d) => d.status === 'FAILED').length || 0;
      // PR-P3.1: targetIds is now native Json. Prisma returns it as a parsed
      // value (or null when the column is null). Default to [] for the
      // admin UI which always wants an array.
      const parsedTargetIds: string[] = Array.isArray(a.targetIds)
        ? (a.targetIds as unknown as string[])
        : [];
      return {
        id: a.id,
        title: a.title,
        message: a.message,
        channel: a.channel,
        targetAudience: a.targetAudience,
        targetIds: parsedTargetIds,
        scheduledAt: a.scheduledAt,
        sentAt: a.sentAt,
        status: a.status,
        totalRecipients: a.totalRecipients,
        deliveredCount: delivered,
        readCount: read,
        failedCount: failed,
        createdBy: a.createdBy,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      };
    });

    return {
      announcements: formatted,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async create(
    data: {
      title: string;
      message: string;
      channel: string;
      targetAudience: string;
      targetIds: string[];
      scheduledAt?: string;
    },
    actorId: string
  ) {
    // PR-4 (9th audit P0): the request no longer fans out to 10k+ riders inside
    // a transaction (30-60s request, pool exhaustion, DoS vector). We persist
    // the announcement row and emit ANNOUNCEMENT_BROADCAST; the background job
    // re-derives recipients and runs the batched insert loop. The audit log
    // still records the intended recipient count. Use a count query (not a
    // findMany of every rider id) so the create stays light at 10k+ riders.
    const recipientCount = await resolveRecipientCount(data.targetAudience, data.targetIds);

    // Explicit enum values keep the property literal (no widening to `string`)
    // so Prisma's AnnouncementStatus input type accepts it.
    const status: AnnouncementStatus =
      data.scheduledAt ? AnnouncementStatus.SCHEDULED : AnnouncementStatus.SENT;
    const sentAt = data.scheduledAt ? null : new Date();
    const announcementData = {
      title: sanitizeHtml(data.title),
      message: sanitizeHtml(data.message),
      channel: data.channel,
      targetAudience: data.targetAudience,
      targetIds: data.targetIds,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      sentAt,
      status,
      totalRecipients: recipientCount,
      createdBy: actorId,
    };

    // Immediate sends with recipients: create the row + emit the outbox event
    // atomically (emitWithCommit — a crash can never leave a SENT announcement
    // with no event to fan it out). All other cases: plain create; the cron
    // emits for scheduled rows when they're due.
    const announcement =
      recipientCount > 0 && !data.scheduledAt
        ? await emitWithCommit(
            OutboxEventTypes.ANNOUNCEMENT_BROADCAST,
            async (tx) => tx.announcement.create({ data: announcementData }),
            async (_tx, created) => ({ announcementId: created.id })
          )
        : await db.announcement.create({ data: announcementData });

    createAuditLog({
      actorId,
      action: 'announcement.create',
      entity: 'announcement',
      entityId: announcement.id,
      details: {
        title: data.title,
        channel: data.channel,
        targetAudience: data.targetAudience,
        recipients: recipientCount,
      },
    }).catch(() => {});

    return {
      id: announcement.id,
      status: announcement.status,
      totalRecipients: announcement.totalRecipients,
      // PR-4: immediate sends are async — the route returns 202 Accepted and
      // the background job does the fanout.
      accepted: recipientCount > 0 && !data.scheduledAt,
    };
  },

  async processScheduledAnnouncements() {
    const dueAnnouncements = await db.announcement.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { lte: new Date() },
      },
      select: { id: true, targetAudience: true, targetIds: true },
    });

    // PR-4: the cron no longer blocks on the fanout either — it emits an
    // ANNOUNCEMENT_BROADCAST event per due announcement and the background
    // job does the batched insert. status stays SCHEDULED until the job
    // flips it to SENT after the fanout completes.
    let processedCount = 0;
    for (const ann of dueAnnouncements) {
      const targetIds: string[] = Array.isArray(ann.targetIds)
        ? (ann.targetIds as string[])
        : [];
      // PR-4 review fix: use a COUNT query, not a findMany of every rider id —
      // the cron must stay light at 10k+ riders (the exact DoS pressure PR-4
      // set out to remove from the request path).
      const recipientCount = await resolveRecipientCount(ann.targetAudience, targetIds);
      if (recipientCount === 0) {
        // No recipients — nothing to fan out; mark sent so the cron doesn't
        // re-emit forever.
        await db.announcement.updateMany({
          where: { id: ann.id, status: 'SCHEDULED' },
          data: { status: 'SENT', sentAt: new Date(), totalRecipients: 0 },
        });
        processedCount++;
        continue;
      }

      // A-1 (W9): Atomically claim the announcement by marking status: SENT
      // so subsequent cron ticks within the processing window will NOT re-emit duplicates.
      const claim = await db.announcement.updateMany({
        where: { id: ann.id, status: 'SCHEDULED' },
        data: { status: 'SENT', sentAt: new Date(), totalRecipients: recipientCount },
      });
      if (claim.count === 0) {
        // Already claimed by a concurrent tick
        continue;
      }

      try {
        await OutboxService.emit(OutboxEventTypes.ANNOUNCEMENT_BROADCAST, {
          announcementId: ann.id,
        });
      } catch (err) {
        logger.warn('[AnnouncementCron] outbox emit failed; rolling back to SCHEDULED', {
          announcementId: ann.id,
          err: err instanceof Error ? err.message : String(err),
        });
        // Roll back so next tick can retry
        await db.announcement.updateMany({
          where: { id: ann.id, status: 'SENT' },
          data: { status: 'SCHEDULED', sentAt: null },
        });
      }
      processedCount++;
    }

    return { processedCount };
  },
};
