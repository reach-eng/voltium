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
  async process(job: {
    id: string;
    payload: unknown;
    error?: string;
  }): Promise<{ count: number }> {
    const payload = (job.payload ?? {}) as Partial<NotificationBroadcastPayload>;

    if (!payload.title || !payload.message) {
      logger.warn('[NotificationBroadcast] Skipping malformed event', {
        jobId: job.id,
        payload,
      });
      return { count: 0 };
    }

    // AUDIT FIX (workflows WF-P2): resume cursor. On a mid-batch failure
    // the job throws `BROADCAST_RESUME:<skip>` (embedded by JobQueue into
    // the event's error field, which the reaper preserves). The retry
    // parses it back so already-delivered batches are not re-sent.
    const resumeMatch = /BROADCAST_RESUME:(\d+)/.exec(job.error ?? '');
    const resumeFromSkip = resumeMatch ? Number(resumeMatch[1]) : 0;

    logger.info('[NotificationBroadcast] Processing', {
      jobId: job.id,
      title: payload.title,
      type: payload.type ?? 'INFO',
      adminId: payload.adminId ?? 'system',
      targets: payload.riderIds?.length ?? 'all',
      resumeFromSkip,
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
    // AUDIT FIX (WF-P2): resumeFromSkip skips already-delivered batches.
    try {
      const result = await notificationUseCases.sendToAllRiders(
        payload.title,
        payload.message,
        payload.type ?? 'INFO',
        payload.adminId ?? 'system',
        100,
        resumeFromSkip
      );

      logger.info('[NotificationBroadcast] Complete', {
        jobId: job.id,
        count: result.count,
      });

      return result;
    } catch (err) {
      // Embed the resume cursor so the retry (JobQueue backoff or reaper)
      // continues where this attempt stopped. The error field survives:
      // the failure-path update writes this message, and the reaper's
      // reclaim prepends rather than erasing (see job-queue AUDIT FIX).
      const completedSkip = resumeMatchOf(err) ?? resumeFromSkip;
      const wrapped = new Error(
        `BROADCAST_RESUME:${completedSkip} | ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      (wrapped as Error & { cause?: unknown }).cause = err;
      throw wrapped;
    }
  },
};

function resumeMatchOf(err: unknown): number | null {
  const m = /BROADCAST_RESUME:(\d+)/.exec(err instanceof Error ? err.message : String(err));
  return m ? Number(m[1]) : null;
}
