import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { notificationService } from '@/lib/notification-service';

interface NotificationsResult {
  birthdays: number;
  paymentReminders: number;
  referralLeaderboard: number;
}

export const notificationsJob = {
  async process(job: any): Promise<NotificationsResult> {
    logger.info('[NotificationsJob] Starting', { jobId: job.id });

    const results: NotificationsResult = { birthdays: 0, paymentReminders: 0, referralLeaderboard: 0 };

    // 1. Birthday Wishes
    const today = new Date();
    const day = today.getDate().toString().padStart(2, '0');
    const month = (today.getMonth() + 1).toString().padStart(2, '0');
    const birthdayString = `${day}-${month}`;

    const birthdayRiders = await db.rider.findMany({
      where: { dob: { startsWith: birthdayString } },
      select: { id: true, fullName: true },
    });

    for (const rider of birthdayRiders) {
      await notificationService
        .notifyBirthdayWish(rider.id, rider.fullName || 'Rider')
        .catch((err: Error) => logger.error('[NotificationsJob] Birthday wish failed', { riderId: rider.id, err }));
      results.birthdays++;
    }

    // 2. Payment Reminders
    const ridersToRemind = await db.rider.findMany({
      where: { wallet: { balanceInPaise: { lt: 0 } }, accountStatus: 'ACTIVE' },
      select: { id: true, wallet: { select: { balanceInPaise: true } } },
    });

    for (const rider of ridersToRemind) {
      await notificationService
        .notifyPaymentReminder(rider.id, Math.abs(rider.wallet?.balanceInPaise ?? 0), 'overdue')
        .catch((err: Error) => logger.error('[NotificationsJob] Payment reminder failed', { riderId: rider.id, err }));
      results.paymentReminders++;
    }

    // 3. Referral Leaderboard
    await notificationService.notifyReferralUpdate().catch((err: Error) =>
      logger.error('[NotificationsJob] Referral update failed', { err })
    );
    results.referralLeaderboard = 1;

    logger.info('[NotificationsJob] Complete', results);
    return results;
  },
};
