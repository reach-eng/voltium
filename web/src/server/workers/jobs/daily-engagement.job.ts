/**
 * Daily engagement worker (BLOCKER 1.4).
 *
 * Replaces the previous misrouted birthday/payment reminder logic which
 * lived in `notifications.job.ts` and was wired to the per-event
 * NOTIFICATION_SEND outbox queue. That meant the daily sweep ran only
 * once per day (idempotency lock) but could not coexist with per-event
 * KYC/topup notifications.
 *
 * This job is fired by a daily cron at 06:00 IST (see `index.ts`
 * `SCHEDULED_TASKS`). It runs:
 *   1. Birthday wishes for riders whose dob matches today (DD-MM).
 *   2. Payment reminders for ACTIVE riders with negative wallet balance.
 *   3. Referral leaderboard broadcast (no-op until personalization ships).
 *
 * The job is idempotent via the daily key `daily_engagement:YYYY-MM-DD`
 * with 48h TTL — re-running on the same day is a no-op.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { istDateKey } from '@/lib/date-keys';
import { notificationService } from '@/lib/notification-service';
import {
  checkOrClaimIdempotency,
  completeIdempotency,
  failIdempotency,
} from '@/lib/idempotency';

export const DAILY_ENGAGEMENT_IST_HOUR = 6; // 06:00 IST per user decision

export interface DailyEngagementResult {
  birthdays: number;
  paymentReminders: number;
  referralLeaderboard: number;
}

export const dailyEngagementJob = {
  async process(job: { id: string }): Promise<DailyEngagementResult> {
    logger.info('[DailyEngagement] Starting', { jobId: job.id });

    // 06:00 IST ≈ 00:30 UTC. We key idempotency on the IST calendar day
    // so the sweep is stable regardless of when the worker fires.
    // PR-108b: use the shared istDateKey helper instead of a hand-rolled
    // Intl.DateTimeFormat. Same shape (YYYY-MM-DD), same TZ.
    const today = istDateKey(clock.now());

    const idempotencyKey = `daily_engagement:${today}`;
    const claim = await checkOrClaimIdempotency(idempotencyKey, 172800); // 48h TTL
    if (claim.status !== 'not_found') {
      logger.info('[DailyEngagement] Already processed today', {
        key: idempotencyKey,
      });
      return { birthdays: 0, paymentReminders: 0, referralLeaderboard: 0 };
    }

    try {
      const results: DailyEngagementResult = {
        birthdays: 0,
        paymentReminders: 0,
        referralLeaderboard: 0,
      };

      // 1. Birthday wishes (DD-MM match against rider.dob stored as DD-MM-YYYY)
      const [, mm, dd] = today.split('-');
      const birthdayString = `${dd}-${mm}`;
      const birthdayRiders = await db.rider.findMany({
        where: { dob: { startsWith: birthdayString } },
        select: { id: true, fullName: true },
      });

      for (const rider of birthdayRiders) {
        await notificationService
          .notifyBirthdayWish(rider.id, rider.fullName ?? 'Rider')
          .catch((err: Error) =>
            logger.error('[DailyEngagement] Birthday wish failed', {
              riderId: rider.id,
              err: (err instanceof Error ? err.message : String(err)),
            })
          );
        results.birthdays++;
      }

      // 2. Payment reminders for ACTIVE riders with negative balance
      const ridersToRemind = (await db.rider.findMany({
        where: { lifecycleStatus: 'ACTIVE', wallet: { balanceInPaise: { lt: 0 } } },
        include: { wallet: true },
      })) as Array<{ id: string; wallet?: { balanceInPaise: number } | null }>;

      for (const rider of ridersToRemind) {
        if (rider.wallet) {
          await notificationService
            .notifyPaymentReminder(
              rider.id,
              Math.abs(rider.wallet.balanceInPaise),
              'overdue'
            )
            .catch((err: Error) =>
              logger.error('[DailyEngagement] Payment reminder failed', {
                riderId: rider.id,
                err: (err instanceof Error ? err.message : String(err)),
              })
            );
          results.paymentReminders++;
        }
      }

      // 3. Referral leaderboard broadcast
      await notificationService
        .notifyReferralUpdate()
        .catch((err: Error) =>
          logger.error('[DailyEngagement] Referral update failed', {
            err: (err instanceof Error ? err.message : String(err)),
          })
        );
      results.referralLeaderboard = 1;

      await completeIdempotency(idempotencyKey, results).catch(() => {});

      logger.info('[DailyEngagement] Complete', results);
      return results;
    } catch (err) {
      await failIdempotency(idempotencyKey).catch(() => {});
      throw err;
    }
  },
};

/**
 * Compute the next 06:00 IST timestamp as a Date (UTC) and return the
 * number of milliseconds to wait. Exported so `index.ts` can compute
 * the next firing time for the scheduled task.
 */
export function msUntilNext0600IST(now: Date = clock.now()): number {
  // Convert current UTC time to IST parts
  const istParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(istParts.find((p) => p.type === type)?.value);

  const istHour = get('hour');
  const istMinute = get('minute');
  const istSecond = get('second');
  const istYear = get('year');
  const istMonth = get('month');
  const istDay = get('day');

  // Compute next 06:00 IST in UTC ms. If we've already passed 06:00 today
  // (IST), schedule for tomorrow.
  const nowIstMs =
    Date.UTC(istYear, istMonth - 1, istDay, istHour, istMinute, istSecond);
  const today0600IstMs = Date.UTC(istYear, istMonth - 1, istDay, 6, 0, 0);
  let target = today0600IstMs;
  if (nowIstMs > today0600IstMs) {
    // Already past 06:00 IST — schedule for tomorrow
    target = Date.UTC(istYear, istMonth - 1, istDay + 1, 6, 0, 0);
  }
  return target - nowIstMs;
}
