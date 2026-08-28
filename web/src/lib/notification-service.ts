import { db } from './db';
import { fcmService } from './fcm';
import { logger } from './logger';
import { posthog } from './posthog-client';

/**
 * Centralized Notification Service
 * Handles business logic for triggering notifications and saving them to DB.
 */
export const notificationService = {
  /**
   * Helper to create DB record and send FCM
   */
  async createAndSend(
    riderId: string,
    title: string,
    message: string,
    type: string,
    data: Record<string, string> = {}
  ) {
    try {
      const VALID_ENUM_TYPES = new Set(['INFO', 'ALERT', 'PROMOTION', 'PAYMENT', 'VEHICLE', 'SOS', 'SYSTEM', 'BIRTHDAY_WISH']);
      const TYPE_MAP: Record<string, 'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'VEHICLE' | 'SOS' | 'SYSTEM' | 'BIRTHDAY_WISH'> = {
        KYC_UPDATE: 'SYSTEM',
        SUPPORT_REPLY: 'INFO',
        PAYMENT_DUE: 'PAYMENT',
        REWARD: 'PROMOTION',
        SHIFT_REMINDER: 'SYSTEM',
      };
      const rawUpper = (type || 'INFO').toUpperCase();
      const sanitizedType = VALID_ENUM_TYPES.has(rawUpper)
        ? (rawUpper as any)
        : (TYPE_MAP[rawUpper] || 'INFO');

      // 1 & 2. Save notification to DB and fetch rider FCM token concurrently in single parallel round-trip
      const [_, rider] = await Promise.all([
        db.notification.create({
          data: {
            riderId,
            title,
            message,
            type: sanitizedType,
          },
        }),
        db.rider.findUnique({
          where: { id: riderId },
          select: { fcmToken: true },
        }),
      ]);

      if (rider?.fcmToken) {
        // 3. Send via FCM
        return await fcmService.sendPushNotification(rider.fcmToken, title, message, data);
      }

      return { success: true, warning: 'Rider has no FCM token' };
    } catch (error) {
      logger.error('[NotificationService] Error:', error);
      // N-2 (PR-C, 2026-08-28 workflows polish): surface FCM delivery
      // failures to PostHog so the on-call engineer can see the rate
      // of dead-letter / transient errors without grepping logs.
      // Event name: `fcm_push_error`. The `posthog.capture` helper
      // already scrubs PII keys (phone, email, otp, etc.) and respects
      // the rate limiter, so this is safe to fire on every failure.
      //
      // TODO(workflows-audit T-95): once the 4xx-vs-transient
      // classification is in place in createAndSend, the `status`
      // property here will differentiate `fcm_push_dead_lettered`
      // (4xx) from `fcm_push_transient_error` (5xx / network).
      // For now both go into a single bucket.
      posthog.capture(
        'fcm_push_error',
        {
          riderId,
          title,
          type,
          status: (error as { code?: string | number; status?: number })?.code
            ?? (error as { status?: number })?.status
            ?? 'unknown',
          error: (error as Error)?.message ?? String(error),
        },
        riderId,
      );
      return { success: false, error };
    }
  },

  async notifyKycStatusChange(riderId: string, status: string, reason?: string) {
    const title = status === 'APPROVED' ? 'KYC Approved! ✅' : 'KYC Update Required ⚠️';
    const message =
      status === 'APPROVED'
        ? 'Your documents have been verified. You can now proceed to pick up your vehicle.'
        : `Your KYC was rejected: ${reason || 'Please re-upload your documents.'}`;

    return this.createAndSend(riderId, title, message, 'KYC_UPDATE', {
      screen: 'KYC_STATUS',
      status,
    });
  },

  async notifySupportReply(riderId: string, ticketId: string, subject: string) {
    return this.createAndSend(
      riderId,
      'Support Ticket Update 💬',
      `New message regarding: ${subject}`,
      'SUPPORT_REPLY',
      {
        screen: 'SUPPORT_TICKET',
        ticketId,
        triggerOverlay: 'SUPPORT_REPLY',
      }
    );
  },

  async notifyPaymentReminder(riderId: string, amount: number, dueDate: string) {
    return this.createAndSend(
      riderId,
      'Payment Reminder 💳',
      `Your rental payment of ₹${amount.toFixed(2)} is due.`,
      'PAYMENT_DUE',
      {
        screen: 'WALLET',
      }
    );
  },

  async notifyRewardMilestone(riderId: string, points: number, title: string) {
    return this.createAndSend(
      riderId,
      'Reward Earned! 🏆',
      `You've earned ${points} points for ${title}.`,
      'REWARD',
      {
        screen: 'REWARDS',
      }
    );
  },

  async notifyBirthdayWish(riderId: string, name: string) {
    return this.createAndSend(
      riderId,
      `Happy Birthday, ${name}! 🎂`,
      'Wishing you a fantastic day ahead. Enjoy a special birthday reward on us!',
      'BIRTHDAY_WISH',
      {
        triggerOverlay: 'BIRTHDAY_WISH',
      }
    );
  },

  async notifyReferralUpdate() {
    logger.info('notifyReferralUpdate triggered (broadcast not yet implemented)');
  },

  async notifyShiftReminder(riderId: string, startTime: string) {
    return this.createAndSend(
      riderId,
      'Upcoming Shift ⏰',
      `Your shift starts at ${startTime}. Please be ready!`,
      'SHIFT_REMINDER'
    );
  },

  async notifyMandatoryUpdate(riderId: string, url: string) {
    const rider = await db.rider.findUnique({ where: { id: riderId }, select: { fcmToken: true } });
    if (rider?.fcmToken) {
      return await fcmService.sendOverlayTrigger(rider.fcmToken, 'MANDATORY_UPDATE', { url });
    }
    return { success: false, error: 'No FCM token' };
  },

  async notifyWalletBalanceLow(riderId: string, balance: number) {
    const rider = await db.rider.findUnique({ where: { id: riderId }, select: { fcmToken: true } });
    if (rider?.fcmToken) {
      return await fcmService.sendOverlayTrigger(rider.fcmToken, 'WALLET_LOW', {
        balance: balance.toString(),
      });
    }
    return { success: false, error: 'No FCM token' };
  },
};
