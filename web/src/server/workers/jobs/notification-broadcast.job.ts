/**
 * Admin "send to all riders" broadcast worker (P0-1/P0-9, 2026-08-05 ops audit).
 *
 * Consumes NOTIFICATION_BROADCAST outbox events emitted by
 * POST /api/admin/notifications (which rate-limits to 3/hr/admin and requires
 * ?confirm=true before emitting). Runs the batched insert loop in the
 * background with a per-batch sleep so 100k riders no longer block an HTTP
 * request (~30-60s) and don't hammer the DB with back-to-back round-trips.
 *
 * JobQueue claim semantics give at-least-once delivery: if the process dies
 * mid-batch, the event is retried (the notification rows are idempotent-ish —
 * duplicate rows are acceptable for a broadcast, matching pre-existing
 * behavior).
 */

import { notificationUseCases } from '@/server/modules/notifications/notification.use-cases';
import { logger } from '@/lib/logger';

export interface NotificationBroadcastPayload {
  title: string;
  message: string;
  type: string;
  adminId: string;
  /**
   * P3-10 (2026-08-05 ops audit): when present, the event is a
   * "send to specific riders" request (up to 100 ids) — the job branches to
   * sendToSpecificRiders instead of the full broadcast loop.
   */
  riderIds?: string[];
}

export const notificationBroadcastJob = {
  async process(job: { id: string; payload: unknown }): Promise<{ count: number }> {
    const payload = (job.payload ?? {}) as Partial<NotificationBroadcastPayload>;

    if (!payload.title || !payload.message) {
      logger.warn('[NotificationBroadcast] Skipping malformed event', {
        jobId: job.id,
        payload,
      });
      return { count: 0 };
    }

    logger.info('[NotificationBroadcast] Processing', {
      jobId: job.id,
      title: payload.title,
      type: payload.type ?? 'INFO',
      adminId: payload.adminId ?? 'system',
      targets: payload.riderIds?.length ?? 'all',
    });

    if (payload.riderIds && payload.riderIds.length > 0) {
      // P3-10: specific-riders send — a single createMany, no batch loop.
      const result = await notificationUseCases.sendToSpecificRiders(
        payload.riderIds,
        payload.title,
        payload.message,
        payload.type ?? 'INFO',
        payload.adminId ?? 'system'
      );
      logger.info('[NotificationBroadcast] Specific send complete', {
        jobId: job.id,
        count: result.count,
      });
      return result;
    }

    // P0-1: 100ms between batches keeps the insert loop off the DB's back
    // while still finishing 100k riders in a reasonable window (~40s).
    const result = await notificationUseCases.sendToAllRiders(
      payload.title,
      payload.message,
      payload.type ?? 'INFO',
      payload.adminId ?? 'system',
      100
    );

    logger.info('[NotificationBroadcast] Complete', {
      jobId: job.id,
      count: result.count,
    });

    return result;
  },
};
