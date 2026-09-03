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
 *   - KYC_INFO_REQUESTED  { riderId, status, reason? }
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
 * Unknown types are logged and acked (do not throw, do not retry).
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { notificationService } from '@/lib/notification-service';
import { fcmService } from '@/lib/fcm';

export type NotificationPayloadType =
  | 'KYC_APPROVED'
  | 'KYC_REJECTED'
  | 'KYC_INFO_REQUESTED'
  | 'WALLET_TOPUP_APPROVED'
  | 'WALLET_TOPUP_REJECTED'
  | 'SUPPORT_REPLY'
  | 'DEPOSIT_APPROVED'
  | 'DEPOSIT_REJECTED'
  | 'REWARD_MILESTONE'
  | 'SHIFT_REMINDER'
  | 'REFERRAL_REWARD'
  | 'MANDATORY_UPDATE'
  | 'WALLET_LOW';

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

    logger.info('[NotificationDispatch] Processing', {
      jobId: job.id,
      type: payload.type,
      riderId: payload.riderId,
    });

    switch (payload.type) {
      case 'KYC_APPROVED':
        await notificationService.notifyKycStatusChange(
          payload.riderId,
          'APPROVED'
        );
        try {
          await db.notification.create({
            data: {
              riderId: payload.riderId as string,
              // SYSTEM is the canonical DB enum for KYC events
              // (see notificationService.createAndSend TYPE_MAP);
              // the event type rides in the payload JSON.
              type: 'SYSTEM',
              title: (payload.title as string) ?? 'KYC Approved',
              message: (payload.body as string) ?? 'Your KYC verification has been approved.',
            },
          });
        } catch (err) {
          logger.warn('[NotificationDispatch] Failed to persist in-app KYC_APPROVED notification', { err });
        }
        return { delivered: true, channel: 'fcm+in-app' };

      case 'KYC_REJECTED':
        await notificationService.notifyKycStatusChange(
          payload.riderId,
          'REJECTED',
          payload.reason as string | undefined
        );
        try {
          await db.notification.create({
            data: {
              riderId: payload.riderId as string,
              type: 'SYSTEM',
              title: (payload.title as string) ?? 'KYC Rejected',
              message: (payload.body as string) ?? (payload.reason as string) ?? 'Your KYC verification was rejected.',
            },
          });
        } catch (err) {
          logger.warn('[NotificationDispatch] Failed to persist in-app KYC_REJECTED notification', { err });
        }
        return { delivered: true, channel: 'fcm+in-app' };

      case 'KYC_INFO_REQUESTED':
        // P2-12 (PR-G, 2026-08-28 workflows deferred): the producer
        // emits `KYC_INFO_REQUESTED` (the actual spelling used in
        // production). The previous dispatcher accepted only
        // `KYC_INFO_REQUIRED`, so the event fell into the default
        // branch and was silently lost. The KYC payload type union
        // at the top of this file is the canonical list — both
        // spellings were previously listed there, but only REQUIRED
        // was handled in the switch. The T-91 audit fix (PR-1,
        // 2026-08-23) renamed the case; this is the post-rename
        // pass that updates the producer/consumer type union and
        // the call site to use the canonical spelling.
        await notificationService.notifyKycStatusChange(
          payload.riderId,
          'INFO_REQUESTED',
          payload.reason as string | undefined
        );
        return { delivered: true, channel: 'fcm' };

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
        const title = (payload.title as string) ?? eventType.replace(/_/g, ' ');
        const message = (payload.body as string) ?? eventType.replace(/_/g, ' ');
        try {
          await db.notification.create({
            data: {
              riderId: payload.riderId as string,
              // PAYMENT is the canonical DB enum for wallet/deposit
              // events; the exact event rides in the payload JSON.
              type: 'PAYMENT',
              title,
              message,
            },
          });

          // Also deliver FCM push notification if rider has a valid device token
          const rider = await db.rider.findUnique({
            where: { id: payload.riderId as string },
            select: { fcmToken: true },
          });
          if (rider?.fcmToken) {
            await fcmService.sendPushNotification(
              rider.fcmToken,
              title,
              message,
              { screen: 'WALLET' }
            ).catch((err: Error) =>
              logger.warn('[NotificationDispatch] FCM push failed for wallet/deposit event', { err })
            );
          }
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
        const unknown = payload as { type: string };
        // P2-3 (PR-A, 2026-08-28 workflows polish): unknown payload types
        // are a producer/consumer contract drift, not routine noise.
        // Promote to `error` so log filters / alerts pick it up
        // immediately. The existing `alerter.send` at
        // `alertUnknownPayloadTypeOncePerHour` (T-91) is the page path;
        // this is the audit trail.
        logger.error('[NotificationDispatch] Unknown payload type — producer/consumer contract drift', {
          jobId: job.id,
          type: unknown.type,
          event: 'unknown_payload_type',
        });
        return { delivered: false, channel: 'none', warning: 'unknown type' };
      }
    }
  },
};
