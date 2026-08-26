import { db } from './db';
import { fcmService } from './fcm';
import { logger } from './logger';
// T-90 + PR-10 (2026-08-23): use the canonical money helper
// instead of inline `amount / 100` arithmetic. The presentation
// boundary lives in `formatRupeesFromPaise` so the rupee
// string format is consistent across server logs, audit
// descriptions, and notification bodies.
import { formatRupeesFromPaise } from './money';

export const CATEGORY_MAP: Record<string, 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM'> = {
  KYC_UPDATE: 'KYC',
  SUPPORT_REPLY: 'SYSTEM',
  PAYMENT_DUE: 'PAYMENT',
  REWARD: 'ANNOUNCEMENT',
  SHIFT_REMINDER: 'SYSTEM',
  BIRTHDAY_WISH: 'ANNOUNCEMENT',
  REFERRAL_REWARD: 'ANNOUNCEMENT',
  MANDATORY_UPDATE: 'SYSTEM',
  WALLET_LOW: 'PAYMENT',
};

const CATEGORY_KEYWORDS: Record<'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT', RegExp[]> = {
  PAYMENT: [/\bpayment\b/i, /\bwallet\b/i, /\btop[\s-]?up\b/i, /\brent\b/i, /\bdeposit\b/i, /\brefund\b/i, /₹/],
  KYC: [/\bkyc\b/i, /\bverification\b/i, /\bverif(y|ied|ication)\b/i, /\bdocument\b/i, /\baadhaar\b/i, /\bpan\b/i],
  MAINTENANCE: [/\bservice\b/i, /\bmaintenance\b/i, /\bvehicle\b/i, /\bbattery\b/i, /\bswap\b/i, /\binspect(ion)?\b/i],
  ANNOUNCEMENT: [/\breward\b/i, /\boffer\b/i, /\bannouncement\b/i, /\bpromotion\b/i, /\bcoupon\b/i, /\bgift\b/i],
};

export function deriveCategoryFromTitle(title: string): 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM' {
  for (const [category, patterns] of Object.entries(CATEGORY_KEYWORDS) as Array<[keyof typeof CATEGORY_KEYWORDS, RegExp[]]>) {
    if (patterns.some((p) => p.test(title))) return category;
  }
  return 'SYSTEM';
}

/**
 * Centralized Notification Service
 * Handles business logic for triggering notifications and saving them to DB.
 */
export const notificationService = {
  /**
   * Helper to create DB record and send FCM.
   */
  async createAndSend(
    riderId: string,
    title: string,
    message: string,
    type: string,
    data: Record<string, string> = {},
    category?: 'PAYMENT' | 'KYC' | 'MAINTENANCE' | 'ANNOUNCEMENT' | 'SYSTEM'
  ): Promise<
    | { success: true; warning?: string; fcmResult?: unknown }
    | { success: false; error: unknown; permanent: boolean }
  > {
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
      ? (rawUpper as 'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'VEHICLE' | 'SOS' | 'SYSTEM' | 'BIRTHDAY_WISH')
      : (TYPE_MAP[rawUpper] || 'INFO');

    const derivedCategory = category
      ?? CATEGORY_MAP[rawUpper]
      ?? (sanitizedType === 'PAYMENT' ? 'PAYMENT' : sanitizedType === 'PROMOTION' ? 'ANNOUNCEMENT' : deriveCategoryFromTitle(title));

    let rider: { fcmToken: string | null } | null = null;
    try {
      // T-95: split the two operations so a failure in the DB
      // write (transient) and a failure in the FCM send
      // (transient or permanent) can be classified independently.
      await db.notification.create({
        data: {
          riderId,
          title,
          message,
          type: sanitizedType,
          category: derivedCategory,
        },
      });
      rider = await db.rider.findUnique({
        where: { id: riderId },
        select: { fcmToken: true },
      });
    } catch (err) {
      // T-95: DB blip is transient — rethrow so the caller
      // (the OutboxEvent dispatcher) can re-queue with backoff.
      logger.error('[NotificationService] DB write failed (transient)', err);
      throw err;
    }

    if (!rider?.fcmToken) {
      return { success: true, warning: 'Rider has no FCM token' };
    }

    try {
      const fcmResult = await fcmService.sendPushNotification(
        rider.fcmToken,
        title,
        message,
        data
      );
      return { success: true, fcmResult };
    } catch (err) {
      // T-95: classify FCM errors. 4xx is permanent (bad token,
      // unregistered device) — return success:false permanent:true
      // so the caller can ack without retry. Anything else
      // (network, 5xx) is transient — rethrow for the backoff.
      const status = (err as { code?: string | number; status?: number }).code ??
        (err as { status?: number }).status;
      const isPermanent =
        typeof status === 'number' && status >= 400 && status < 500;
      if (isPermanent) {
        logger.warn(
          '[NotificationService] FCM 4xx — permanent, acking without retry',
          { riderId, status }
        );
        return { success: false, error: err, permanent: true };
      }
      logger.error('[NotificationService] FCM transient error — rethrowing for backoff', err);
      throw err;
    }
  },

  async notifyKycStatusChange(riderId: string, status: string, reason?: string) {
    const title = status === 'APPROVED' ? 'KYC Approved! ✅' : 'KYC Update Required ⚠️';
    const message =
      status === 'APPROVED'
        ? 'Your documents have been verified. You can now proceed to pick up your vehicle.'
        : `Your KYC was rejected: ${reason || 'Please re-upload your documents.'}`;

    return this.createAndSend(
      riderId,
      title,
      message,
      'KYC_UPDATE',
      {
        screen: 'KYC_STATUS',
        status,
      },
      'KYC'
    );
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
      },
      'SYSTEM'
    );
  },

  /**
   * Send a payment reminder push. T-90 (PR-1, 2026-08-23): the
   * `amountInPaise` parameter is now explicit and required in the
   * JSDoc. The previous signature took a bare `amount: number` and
   * formatted it as if rupees (`₹${amount.toFixed(2)}`), which
   * multiplied any paise value by 100 in the rendered text (a
   * ₹500 rent rendered as "₹50000.00"). All 4 in-repo call sites
   * already pass paise; the presentation boundary now lives here
   * in the service.
   *
   * @param riderId          The rider the reminder is for.
   * @param amountInPaise    Amount in PAISE (1 INR = 100 paise).
   *                         Do NOT pass rupees. The reminder template
   *                         divides by 100 at render time.
   * @param reminderType     'payment_receipt' (after a successful
   *                         debit), 'proactive_24h' (rent due in
   *                         < 24h), 'overdue' (debit failed, balance
   *                         is negative), or a freeform label.
   */
  async notifyPaymentReminder(
    riderId: string,
    amountInPaise: number,
    reminderType: string
  ) {
    // T-90 + PR-10 (2026-08-23): use the canonical money helper
    // for the presentation boundary. The previous inline
    // `(amount / 100).toFixed(2)` produced "₹50000.00" for a
    // 50000-paise (= ₹500) value because the division-by-100
    // was missing. `formatRupeesFromPaise` does the divide
    // itself, so this site is just `formatRupeesFromPaise(N)`.
    const body = `Your rental payment of ${formatRupeesFromPaise(amountInPaise || 0)} is due.`;
    return this.createAndSend(
      riderId,
      'Payment Reminder 💳',
      body,
      'PAYMENT_DUE',
      {
        screen: 'WALLET',
        // T-90: also include the paise in the data payload so
        // client-side formatters (which already use paise) can
        // render their own currency-correct text without a
        // double-conversion.
        amountInPaise: String(amountInPaise),
        reminderType,
      },
      'PAYMENT'
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
      },
      'ANNOUNCEMENT'
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
      },
      'ANNOUNCEMENT'
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
      'SHIFT_REMINDER',
      {},
      'SYSTEM'
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
