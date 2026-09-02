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
import { fcmService } from '@/lib/fcm';
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

    let recipients: { id: string; fcmToken: string | null }[] = [];
    if (announcement.targetAudience === 'ALL') {
      recipients = await db.rider.findMany({ select: { id: true, fcmToken: true } });
    } else if (announcement.targetAudience === 'BY_HUB') {
      recipients = await db.rider.findMany({
        where: { pickupHub: { in: targetIds } },
        select: { id: true, fcmToken: true },
      });
    } else if (announcement.targetAudience === 'BY_STATUS') {
      recipients = await db.rider.findMany({
        where: { lifecycleStatus: { in: targetIds as RiderLifecycleStatus[] } },
        select: { id: true, fcmToken: true },
      });
    } else if (announcement.targetAudience === 'BY_PLAN') {
      recipients = await db.rider.findMany({
        where: { currentPlan: { in: targetIds } },
        select: { id: true, fcmToken: true },
      });
    }

    // AUDIT-RECON 2026-09-02 batch 4 P0-1: the `channel` field on
    // Announcement distinguishes in-app (INFO) from push (PUSH). The
    // schema and the validator already let the admin pick a channel,
    // but the broadcast worker only ever wrote to the Notification
    // table — a PUSH announcement arrived in the bell icon on next
    // open but never woke the device. Honor the channel here: PUSH
    // → also fire an FCM push per rider with a token; INFO → in-app
    // only (current behavior). Best-effort: a missing/stale token
    // silently skips the push, the in-app row is the source of truth
    // (matches the pattern in notification.use-cases.ts:144).
    const shouldPush = announcement.channel === 'PUSH';

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
      // AUDIT-RECON 2026-09-02 batch 4 P0-1: per-rider FCM push for
      // channel === 'PUSH'. Fired AFTER the in-app row is written so
      // the bell-icon entry is the source of truth if FCM is down.
      // Best-effort: a missing/stale token silently skips (matches
      // notification.use-cases.ts:144). We don't await the promises
      // to keep the batch loop off the FCM critical path — a slow
      // FCM round-trip shouldn't hold up the next DB batch.
      if (shouldPush) {
        for (const r of batch) {
          if (!r.fcmToken) continue;
          fcmService
            .sendPushNotification(
              r.fcmToken,
              announcement.title,
              announcement.message,
              {
                screen: 'NOTIFICATIONS',
                announcementId: announcement.id,
              },
            )
            .catch((err) =>
              logger.warn('[AnnouncementBroadcast] FCM push failed', {
                announcementId: announcement.id,
                riderId: r.id,
                err: err instanceof Error ? err.message : String(err),
              }),
            );
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
