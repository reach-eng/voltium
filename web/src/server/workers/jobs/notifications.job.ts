import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { notificationService } from '@/lib/notification-service';
import { checkOrClaimIdempotency, completeIdempotency, failIdempotency } from '@/lib/idempotency';

interface NotificationsResult {
  birthdays: number;
  paymentReminders: number;
  referralLeaderboard: number;
}

export const notificationsJob = {
  async process(job: any): Promise<NotificationsResult> {
    logger.info('[NotificationsJob] Starting', { jobId: job.id });

    // Idempotency guard — one run per day
    const today = clock.now().toISOString().split('T')[0];
    const idempotencyKey = `notifications:daily:${today}`;
    const claim = await checkOrClaimIdempotency(idempotencyKey, 172800); // 48h TTL
    if (claim.status !== 'not_found') {
      logger.info('[NotificationsJob] Already processed today', { key: idempotencyKey });
      return { birthdays: 0, paymentReminders: 0, referralLeaderboard: 0 };
    }

    try {
      const results: NotificationsResult = {
        birthdays: 0,
        paymentReminders: 0,
        referralLeaderboard: 0,
      };

      // 1. Birthday Wishes
      const day = today.split('-')[2] || clock.now().getDate().toString().padStart(2, '0');
      const month = (clock.now().getMonth() + 1).toString().padStart(2, '0');
      const birthdayString = `${day}-${month}`;

      const birthdayRiders = await db.rider.findMany({
        where: { dob: { startsWith: birthdayString } },
        select: { id: true, fullName: true },
      });

      for (const rider of birthdayRiders) {
        await notificationService
          .notifyBirthdayWish(rider.id, rider.fullName || 'Rider')
          .catch((err: Error) =>
            logger.error('[NotificationsJob] Birthday wish failed', { riderId: rider.id, err })
          );
        results.birthdays++;
      }

      // 2. Payment Reminders
      const ridersToRemind = (await db.rider.findMany({
        where: { lifecycleStatus: 'ACTIVE', wallet: { balanceInPaise: { lt: 0 } } },
        include: { wallet: true },
      })) as any;

      for (const rider of ridersToRemind) {
        if (rider.wallet) {
          await notificationService
            .notifyPaymentReminder(rider.id, Math.abs(rider.wallet.balanceInPaise), 'overdue')
            .catch((err: Error) =>
              logger.error('[NotificationsJob] Payment reminder failed', { riderId: rider.id, err })
            );
          results.paymentReminders++;
        }
      }

      // 3. Referral Leaderboard
      await notificationService
        .notifyReferralUpdate()
        .catch((err: Error) => logger.error('[NotificationsJob] Referral update failed', { err }));
      results.referralLeaderboard = 1;

      // Mark idempotency as completed
      await completeIdempotency(idempotencyKey, results).catch(() => {});

      logger.info('[NotificationsJob] Complete', results);
      return results;
    } catch (err) {
      // Allow retry on failure
      await failIdempotency(idempotencyKey).catch(() => {});
      throw err;
    }
  },
};
