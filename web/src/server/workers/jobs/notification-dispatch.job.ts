/**
 * Per-event notification dispatcher (BLOCKER 1.4).
 *
 * Replaces the previous misrouted mapping where the outbox
 * NOTIFICATION_SEND event type was wired to the daily birthday/payment
 * reminder job. That meant every per-event KYC/topup/support notification
 * was processed by a worker that ignored its payload and ran only
 * once per day. The actual delivery happened only via a parallel
 * synchronous call in the request handler, which meant a failure in
 * that path was lost (no retry).
 *
 * This job:
 *  - Reads the event payload.
 *  - Dispatches by `payload.type` to the matching domain notification.
 *  - Returns normally on success; throws on failure so JobQueue
 *    retries with exponential backoff.
 *  - Has NO daily idempotency lock — every event is processed exactly
 *    once via the OutboxEvent's own claim semantics.
 *
 * Known payload types (from use-cases that emit NOTIFICATION_SEND):
 *   - KYC_APPROVED        { riderId, status, reason? }
 *   - KYC_REJECTED        { riderId, status, reason? }
 *   - KYC_INFO_REQUIRED   { riderId, status, reason? }
 *   - KYC_INFO_REQUESTED  { riderId, infoRequest }   (T-91: 2026-08-23)
 *   - WALLET_TOPUP_APPROVED { riderId, amount, transactionId }
 *   - WALLET_TOPUP_REJECTED { riderId, amount, transactionId, reason }
 *   - SUPPORT_REPLY       { riderId, ticketId, subject }
 *   - DEPOSIT_APPROVED     { riderId, amount }
 *   - DEPOSIT_REJECTED     { riderId, reason }
 *   - REWARD_MILESTONE     { riderId, points, title }
 *   - SHIFT_REMINDER       { riderId, startTime }
 *   - REFERRAL_REWARD      { riderId, code, points }
 *   - MANDATORY_UPDATE     { riderId, url }    (overlay)
 *   - WALLET_LOW           { riderId, balance } (overlay)
 *
 * T-91 (2026-08-23): unknown types are NO LONGER silently acked.
 * The first unknown value per hour fires an `alerter.send` so the
 * next spelling mismatch pages the team within 1h instead of
 * surfacing only via a missing-rider-notification support ticket.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { notificationService } from '@/lib/notification-service';
import { fcmService } from '@/lib/fcm';
import { clock } from '@/lib/clock';
import {
  type NotificationPayloadType,
  isNotificationPayloadType,
} from '../notification-payload-types';

export type { NotificationPayloadType } from '../notification-payload-types';

export interface NotificationPayload {
  type: NotificationPayloadType;
  riderId: string;
  [key: string]: unknown;
}

interface DispatchResult {
  delivered: boolean;
  // 'fcm+in-app' (KYC cases): both the FCM push AND the in-app row were
  // written — the channel reflects the real delivery path.
  channel: 'fcm' | 'overlay' | 'in-app' | 'fcm+in-app' | 'none';
  warning?: string;
  // T-95: optional raw result from the underlying service call.
  // The dispatcher's job-queue layer uses this to decide
  // permanent-vs-transient retry behavior (see createAndSend).
  result?: unknown;
}

export const notificationDispatchJob = {
  async process(job: { id: string; payload: unknown }): Promise<DispatchResult> {
    const payload = (job.payload ?? {}) as NotificationPayload;

    if (!payload.type || !payload.riderId) {
      logger.warn('[NotificationDispatch] Skipping malformed event', {
        jobId: job.id,
        payload,
      });
      return { delivered: false, channel: 'none', warning: 'malformed payload' };
    }

    // T-91 (PR-1, 2026-08-23): runtime type guard. The TypeScript
    // union at the top of this file already gives build-time safety
    // for in-repo callers, but the outbox payload is JSON serialized
    // at the DB boundary, so an out-of-band emit (admin script, raw
    // SQL) could push an unknown type. Validate before dispatching.
    if (!isNotificationPayloadType(payload.type)) {
      logger.warn('[NotificationDispatch] Invalid payload type', {
        jobId: job.id,
        type: payload.type,
      });
      await alertUnknownPayloadTypeOncePerHour(String(payload.type));
      // T-91: keep the existing `unknown type` warning for the
      // existing test contract. The alert is the new bit.
      return { delivered: false, channel: 'none', warning: 'unknown type' };
    }

    logger.info('[NotificationDispatch] Processing', {
      jobId: job.id,
      type: payload.type,
      riderId: payload.riderId,
    });

    switch (payload.type) {
      case 'KYC_APPROVED':
        // T-95 (PR-5, 2026-08-23): the previous code called
        // `notificationService.notifyKycStatusChange(...)` AND
        // `db.notification.create(...)` separately, producing TWO
        // notification rows per KYC decision. `createAndSend`
        // already persists the in-app row (see
        // notification-service.ts:35-48); the explicit
        // `db.notification.create` here is the duplicate.
        const approvedResult = await notificationService.notifyKycStatusChange(
          payload.riderId,
          'APPROVED'
        );
        return { delivered: true, channel: 'fcm+in-app', result: approvedResult };

      case 'KYC_REJECTED':
        // T-95: same dedup as KYC_APPROVED.
        const rejectedResult = await notificationService.notifyKycStatusChange(
          payload.riderId,
          'REJECTED',
          payload.reason as string | undefined
        );
        return { delivered: true, channel: 'fcm+in-app', result: rejectedResult };

      case 'KYC_INFO_REQUIRED':
      case 'KYC_INFO_REQUESTED':
        // T-91 (PR-1, 2026-08-23): the kyc.use-cases.ts REQUEST_INFO
        // branch emits `type: 'KYC_INFO_REQUESTED'` (the actual spelling
        // used in production). The previous dispatcher only handled
        // 'KYC_INFO_REQUIRED' so the event fell into the default-ack
        // branch and was silently lost — riders were never told their
        // KYC needed action. Accept both spellings for compatibility
        // and persistence: call the same FCM + in-app path so the rider
        // sees the KYC info-request no matter which spelling the
        // producer used.
        //
        // T-95 (PR-5, 2026-08-23): the previous KYC_INFO_REQUESTED
        // case ALSO had a duplicate `db.notification.create`. The
        // service's createAndSend already persists, so the explicit
        // row write is removed.
        await notificationService.notifyKycStatusChange(
          payload.riderId,
          'INFO_REQUIRED',
          (payload.reason as string | undefined) ??
            (payload.infoRequest as string | undefined)
        );
        return { delivered: true, channel: 'fcm+in-app' };

      case 'WALLET_TOPUP_APPROVED':
      case 'WALLET_TOPUP_REJECTED':
      case 'DEPOSIT_APPROVED':
      case 'DEPOSIT_REJECTED': {
        // PR-78: actually persist a Notification row so the in-app
        // notification center has a record. The previous code returned
        // `delivered:true, channel:'in-app'` without a side effect,
        // so the OutboxEvent was acked but the rider never saw
        // anything if the in-request `notificationService` call failed.
        const eventType = String(payload.type);
        try {
          await db.notification.create({
            data: {
              riderId: payload.riderId as string,
              // PAYMENT is the canonical DB enum for wallet/deposit
              // events; the exact event rides in the payload JSON.
              type: 'PAYMENT',
              category: 'PAYMENT',
              title: (payload.title as string) ?? eventType.replace(/_/g, ' '),
              message: (payload.body as string) ?? eventType.replace(/_/g, ' '),
            },
          });
        } catch (err) {
          logger.warn('[NotificationDispatch] Failed to persist in-app notification', {
            eventType: payload.type,
            riderId: payload.riderId,
            err,
          });
          // Fall through — the OutboxEvent is acked either way.
        }
        return { delivered: true, channel: 'in-app' };
      }

      case 'SUPPORT_REPLY':
        await notificationService.notifySupportReply(
          payload.riderId,
          payload.ticketId as string,
          (payload.subject as string) ?? 'Your ticket'
        );
        return { delivered: true, channel: 'fcm' };

      case 'REWARD_MILESTONE':
        await notificationService.notifyRewardMilestone(
          payload.riderId,
          payload.points as number,
          (payload.title as string) ?? 'Reward earned'
        );
        return { delivered: true, channel: 'fcm' };

      case 'SHIFT_REMINDER':
        await notificationService.notifyShiftReminder(
          payload.riderId,
          (payload.startTime as string) ?? ''
        );
        return { delivered: true, channel: 'fcm' };

      case 'MANDATORY_UPDATE':
      case 'WALLET_LOW': {
        // Overlay trigger — look up rider's FCM token and send via
        // raw FCM. The notificationService already has higher-level
        // wrappers for these but they are outbox-driven by different
        // event types in some places, so we keep this path explicit.
        const rider = await db.rider.findUnique({
          where: { id: payload.riderId },
          select: { fcmToken: true },
        });
        if (!rider?.fcmToken) {
          logger.warn('[NotificationDispatch] No FCM token for overlay', {
            riderId: payload.riderId,
            type: payload.type,
          });
          return {
            delivered: false,
            channel: 'overlay',
            warning: 'no FCM token',
          };
        }
        const extra: Record<string, string> =
          payload.type === 'WALLET_LOW'
            ? { balance: String(payload.balance ?? '0') }
            : { url: (payload.url as string) ?? '' };
        await fcmService
          .sendOverlayTrigger(rider.fcmToken, payload.type, extra)
          .catch((err: Error) =>
            logger.warn('[NotificationDispatch] FCM overlay failed', {
              err: (err instanceof Error ? err.message : String(err)),
            })
          );
        return { delivered: true, channel: 'overlay' };
      }

      case 'REFERRAL_REWARD':
        // Currently the in-app broadcast (no FCM) — kept for future
        // personalization. Logged so the OutboxEvent is acked.
        return { delivered: false, channel: 'none' };

      default: {
        // T-91 (PR-1, 2026-08-23): unknown types are NO LONGER
        // silently acked. The previous behavior swallowed the entire
        // class of producer/consumer spelling mismatches (see
        // KYC_INFO_REQUESTED history). Page the team on the FIRST
        // unknown type per hour so a future mismatch is caught
        // within 1h, not weeks later via a "rider never got the
        // notification" support ticket.
        const unknown = payload as { type: string };
        logger.warn('[NotificationDispatch] Unknown payload type — acking', {
          jobId: job.id,
          type: unknown.type,
        });
        await alertUnknownPayloadTypeOncePerHour(String(unknown.type));
        return { delivered: false, channel: 'none', warning: 'unknown type' };
      }
    }
  },
};

/**
 * T-91 (PR-1, 2026-08-23): alert the team on the first occurrence of
 * an unknown NOTIFICATION_SEND payload type per hour. A producer/
 * consumer spelling mismatch (or a new event type added to the
 * producer without a matching case in the dispatcher) is a silent
 * delivery failure for the rider — this gives the on-call engineer
 * a Slack page within 1h of the first occurrence.
 *
 * The 1h cap is in-memory only; it resets across process restarts
 * (intentional — a fresh process = "first occurrence" again, which
 * is the safe direction for alerts).
 */
const _unknownAlertedThisHour = new Map<string, number>();
async function alertUnknownPayloadTypeOncePerHour(type: string): Promise<void> {
  if (!type) return;
  // T-97 + PR-10 (2026-08-23): use clock.now() (testable) instead
  // of Date.now() (not testable). The previous Date.now() was
  // flagged by the PR-M workers-jobs-error-handling test which
  // asserts every job that computes a current timestamp uses
  // clock.now().
  const now = clock.now().getTime();
  const last = _unknownAlertedThisHour.get(type) ?? 0;
  if (now - last < 60 * 60 * 1000) return;
  _unknownAlertedThisHour.set(type, now);
  try {
    const { alerter } = await import('@/lib/alerter');
    await alerter.send({
      level: 'warn',
      title: 'Unknown NOTIFICATION_SEND payload type',
      message: `dispatcher received unknown type "${type}" — likely a producer/consumer spelling mismatch. The event was acked without a side effect; the rider did NOT receive a notification.`,
      source: 'workers/jobs/notification-dispatch.job',
      details: { type },
    });
  } catch (err) {
    // Alerting must never break dispatch.
    logger.error('[NotificationDispatch] alerter.send failed', { err });
  }
}
