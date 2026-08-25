/**
 * Announcement fanout worker (PR-4, 2026-08-06 fix-plan; 9th audit P0).
 *
 * Consumes ANNOUNCEMENT_BROADCAST outbox events emitted by
 * POST /api/admin/announcements (immediate sends) or the scheduled-announcements
 * cron. Runs the batched insert loop in the background with a per-batch sleep
 * so 10k+ recipients no longer hold an HTTP request open for 30-60s, block the
 * connection pool, or act as a DoS vector (the 9th audit finding).
 *
 * JobQueue claim semantics give at-least-once delivery: if the process dies
 * mid-batch the event is retried. The retry re-runs createMany for the whole
 * audience; the `@@unique([announcementId, riderId])` constraint (PR-4
 * migration) makes `skipDuplicates` a true no-op for rows that already
 * landed, so a retry can never duplicate a delivery row or inflate
 * deliveredCount/readCount.
 */

import { db } from '@/lib/db';
import { type QueueJob } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { sendSms } from '@/lib/sms-provider';
import type { RiderLifecycleStatus } from '@prisma/client';

export interface AnnouncementBroadcastPayload {
  announcementId: string;
}

export const announcementBroadcastJob = {
  async process(job: { id: string; payload: unknown }): Promise<{ count: number }> {
    const payload = (job.payload ?? {}) as Partial<AnnouncementBroadcastPayload>;

    if (!payload.announcementId) {
      logger.warn('[AnnouncementBroadcast] Skipping malformed event', {
        jobId: job.id,
        payload,
      });
      return { count: 0 };
    }

    const announcement = await db.announcement.findUnique({
      where: { id: payload.announcementId },
    });
    if (!announcement) {
      logger.error('[AnnouncementBroadcast] Announcement not found', {
        announcementId: payload.announcementId,
      });
      return { count: 0 };
    }

    // NOTE: do NOT skip on `status === 'SENT'` — immediate sends are created
    // with status SENT by the use-case (the route returns 202 before the
    // fanout runs), so a status guard would skip the very first fanout.
    // Idempotency comes from the delivery-row subtraction below (+ the
    // unique (announcementId, riderId) constraint as a second net), which
    // makes retries safe at any point.

    // Re-derive recipients (same audience logic as announcement.use-cases).
    const targetIds: string[] = Array.isArray(announcement.targetIds)
      ? (announcement.targetIds as string[])
      : [];

    let recipients: { id: string; phone?: string | null }[] = [];
    if (announcement.targetAudience === 'ALL') {
      recipients = await db.rider.findMany({ select: { id: true, phone: true } });
    } else if (announcement.targetAudience === 'BY_HUB') {
      recipients = await db.rider.findMany({
        where: { pickupHub: { in: targetIds } },
        select: { id: true, phone: true },
      });
    } else if (announcement.targetAudience === 'BY_STATUS') {
      recipients = await db.rider.findMany({
        where: { lifecycleStatus: { in: targetIds as RiderLifecycleStatus[] } },
        select: { id: true, phone: true },
      });
    } else if (announcement.targetAudience === 'BY_PLAN') {
      recipients = await db.rider.findMany({
        where: { currentPlan: { in: targetIds } },
        select: { id: true, phone: true },
      });
    }

    const notificationType = announcement.channel === 'PUSH' ? 'ALERT' : 'INFO';

    // PR-4 review fix: subtract riders who already have a delivery row (from a
    // prior partial run / replayed event) so ONLY new riders get delivery +
    // notification rows. `notification.createMany(skipDuplicates)` alone is a
    // silent no-op (Notification has no unique constraint), so without this
    // subtraction a retry would spam duplicate in-app notifications even
    // though delivery rows were deduped. The findMany here is one indexed
    // query per announcement (not per batch).
    const existingDeliveries = await db.announcementDelivery.findMany({
      where: { announcementId: announcement.id },
      select: { riderId: true },
    });
    const existingRiderIds = new Set(
      existingDeliveries.map((d: { riderId: string }) => d.riderId)
    );
    const newRecipients = recipients.filter((r) => !existingRiderIds.has(r.id));

    // Batched insert with a 100ms sleep between batches — keeps the fanout
    // off the DB's back while still finishing 100k riders in a sane window.
    // skipDuplicates: true stays as a second net behind the unique constraint.
    const BATCH_SIZE = 500;
    for (let i = 0; i < newRecipients.length; i += BATCH_SIZE) {
      const batch = newRecipients.slice(i, i + BATCH_SIZE);
      await db.announcementDelivery.createMany({
        data: batch.map((r) => ({
          announcementId: announcement.id,
          riderId: r.id,
          status: 'PENDING',
        })),
        skipDuplicates: true,
      });
      await db.notification.createMany({
        data: batch.map((r) => ({
          riderId: r.id,
          title: announcement.title,
          message: announcement.message,
          type: notificationType,
        })),
        skipDuplicates: true,
      });

      // A-2 (W9): dispatch SMS when announcement channel is SMS
      if (announcement.channel === 'SMS') {
        for (const r of batch) {
          if (r.phone) {
            sendSms(r.phone, `${announcement.title}: ${announcement.message}`).catch((err) =>
              logger.error('[AnnouncementBroadcast] SMS send error', err)
            );
          }
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    // Mark the announcement as sent only after the fanout completes.
    await db.announcement.update({
      where: { id: announcement.id },
      data: { status: 'SENT', sentAt: clock.now() },
    });

    logger.info('[AnnouncementBroadcast] Sent', {
      announcementId: announcement.id,
      count: recipients.length,
    });

    return { count: recipients.length };
  },
};
