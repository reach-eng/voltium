import { db } from './db';
import { fcmService } from './fcm';
import { logger } from './logger';

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
      // 1. Save to database
      await db.notification.create({
        data: {
          riderId,
          title,
          message,
          type: type as 'INFO' | 'ALERT' | 'PROMOTION' | 'PAYMENT' | 'VEHICLE' | 'SOS' | 'SYSTEM',
        },
      });

      // 2. Fetch rider FCM token
      const rider = await db.rider.findUnique({
        where: { id: riderId },
        select: { fcmToken: true },
      });

      if (rider?.fcmToken) {
        // 3. Send via FCM
        return await fcmService.sendPushNotification(rider.fcmToken, title, message, data);
      }

      return { success: true, warning: 'Rider has no FCM token' };
    } catch (error) {
      logger.error('[NotificationService] Error:', error);
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
