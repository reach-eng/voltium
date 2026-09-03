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

      // 1 & 2. Save notification to DB (if title/message present) and fetch rider FCM token concurrently
      const [_, rider] = await Promise.all([
        (title || message)
          ? db.notification.create({
              data: {
                riderId,
                title,
                message,
                type: sanitizedType,
              },
            })
          : Promise.resolve(null),
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
      // T-95 (PR-E, 2026-08-28 workflows deferred): the workflows
      // audit's T-95 was supposed to add a 4xx-vs-transient
      // classification to createAndSend. The audit claimed it
      // shipped in PR-5 (2026-08-23), but the code shows only the
      // duplicate-row removal was applied — the retry-contract
      // half was missed. This block closes the gap.
      //
      // 4xx (Firebase Admin: bad token, unregistered device, invalid
      // payload) is permanent: the token won't get any better;
      // acking without retry is correct. The dispatcher's
      // job-queue layer must see the failure (so it can update
      // the audit trail) but must NOT requeue.
      //
      // 5xx and network errors are transient: re-throw so the
      // job-queue backoff engages. The OutboxEvent stays
      // PENDING/PROCESSING and will be retried on the next poll
      // cycle.
      const err = error as { code?: string | number; status?: number; message?: string };
      const status = err?.code ?? err?.status;
      const isPermanent =
        typeof status === 'number' && status >= 400 && status < 500;

      if (isPermanent) {
        logger.warn(
          '[NotificationService] FCM 4xx — permanent, acking without retry',
          { riderId, type, status },
        );
        posthog.capture(
          'fcm_push_dead_lettered',
          {
            riderId,
            title,
            type,
            status,
            error: err?.message ?? String(error),
          },
          riderId,
        );
        return { success: false, error, permanent: true };
      }

      logger.error(
        '[NotificationService] FCM transient error — rethrowing for backoff',
        { riderId, type, status, error: err?.message },
      );
      posthog.capture(
        'fcm_push_transient_error',
        {
          riderId,
          title,
          type,
          status: status ?? 'unknown',
          error: err?.message ?? String(error),
        },
        riderId,
      );
      throw error;
    }
  },

  async notifyKycStatusChange(
    riderId: string,
    status: 'APPROVED' | 'REJECTED' | 'INFO_REQUESTED',
    reason?: string,
  ) {
    // P2-12 (PR-G, 2026-08-28 workflows deferred): don't pre-format
    // the title/message on the server. Send the discriminator +
    // structured data; the Flutter client renders the localized
    // string from its ARB bundle (kycPushTitleApproved /
    // kycPushBodyApproved, etc.). This is the only way a Hindi
    // rider sees the KYC push in Hindi — the previous shape
    // hard-coded English text in the FCM payload.
    //
    // The empty `title` and `message` here mean the FCM
    // `notification` block is empty; the Flutter side reads the
    // FCM `data` block (which carries the discriminator) and
    // renders the LOCAL notification with the localized strings.
    return this.createAndSend(riderId, '', '', 'KYC_UPDATE', {
      screen: 'KYC_STATUS',
      type: `KYC_${status}`, // KYC_APPROVED | KYC_REJECTED | KYC_INFO_REQUESTED
      ...(reason ? { reason } : {}),
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
