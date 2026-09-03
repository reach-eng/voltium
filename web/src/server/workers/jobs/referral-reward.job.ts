import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { type QueueJob } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { OutboxService, OutboxEventTypes } from '../outbox';
import { lifecycleRankOf } from '@/lib/lifecycle-ranks';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { createAuditLog } from '@/lib/audit-log';

interface ReferralRewardResult {
  referredRiders: number;
  rewardsCredited: number;
  errors: number;
}

export const referralRewardJob = {
  async process(job: QueueJob): Promise<ReferralRewardResult> {
    logger.info('[ReferralRewardJob] Starting', { jobId: job.id, payload: job.payload });

    const result: ReferralRewardResult = { referredRiders: 0, rewardsCredited: 0, errors: 0 };

    // Find riders who were referred but haven't had rewards processed yet
    // This runs on-demand when a new rider signs up with a referral code
    const referredRiderId = job.payload?.referredRiderId as string | undefined;
    const referrerCode = job.payload?.referralCode as string | undefined;

    if (!referredRiderId || !referrerCode) {
      logger.warn('[ReferralRewardJob] Missing payload fields', { payload: job.payload });
      result.errors++;
      return result;
    }

    // Find the referrer by referral code
    const referrer = await db.rider.findUnique({
      where: { referralCode: referrerCode },
      select: { id: true, wallet: { select: { id: true } } },
    });

    if (!referrer || !referrer.wallet) {
      logger.warn('[ReferralRewardJob] Referrer not found or has no wallet', {
        referralCode: referrerCode,
      });
      result.errors++;
      return result;
    }

    // P0 fix 2026-09-03: pay ONLY once the referee reaches ACTIVE
    // (rank >= 11). Early invocations are a no-op (deferred, not an error —
    // the lifecycle hook / admin reconcile retries after activation).
    const referee = await db.rider.findUnique({
      where: { id: referredRiderId },
      select: { lifecycleStatus: true },
    });
    if (!referee) {
      logger.warn('[ReferralRewardJob] Referee not found', { referredRiderId });
      result.errors++;
      return result;
    }
    if (lifecycleRankOf(referee.lifecycleStatus) < 11) {
      logger.info('[ReferralRewardJob] Referee not yet ACTIVE, deferred', {
        referredRiderId,
        status: referee.lifecycleStatus,
      });
      return result;
    }

    // PR-77: read reward amount from settings so the use-case path
    // and the job path pay the same amount. The previous hardcoded
    // ₹100 (10000 paise) was lower than the use-case's default
    // ₹200 (20000 paise), creating a divergence if both paths
    // were ever wired. Default to 20000 paise (₹200) to match.
    // PR-102 (B-RF1): the stored value is in PAISE (see
    // settings.registry.ts coerceSettingValue). We use it directly —
    // no `* 100` conversion. This matches the use-case path.
    const rewardSetting = await db.systemSetting.findUnique({ where: { key: 'referralBonus' } });
    const REWARD_AMOUNT_PAISE = rewardSetting ? parseInt(rewardSetting.value) || 20000 : 20000;
    // PR-102 (B-RF1): the idempotencyKey format is the SINGLE GUARD
    // that prevents a double-pay if both this job AND the use-case
    // path (POST /api/admin/referrals) race for the same (referrer,
    // referee) pair. The key format MUST match the use-case's
    // `referral:${referrer.id}:${refereeId}` exactly — the
    // `WalletLedger.idempotencyKey` UNIQUE constraint in the DB is
    // the authoritative arbiter. Keep both paths in lockstep.
    const idempotencyKey = `referral:${referrer.id}:${referredRiderId}`;

    // P0 fix 2026-09-03: authoritative pre-check on the ledger key (the old
    // code had no pre-check and counted P2002 races as errors — noisy but
    // safe; now races are clean no-ops).
    const alreadyPaid = await db.walletLedger.findUnique({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (alreadyPaid) {
      logger.info('[ReferralRewardJob] Already paid, skipping', {
        referrerId: referrer.id,
        referredRiderId,
      });
      result.rewardsCredited++;
      result.referredRiders = 1;
      return result;
    }

    try {
      await db.$transaction(async (tx) => {
        const txn = await tx.transaction.create({
          data: {
            riderId: referrer.id,
            type: 'CREDIT',
            amountInPaise: REWARD_AMOUNT_PAISE,
            purpose: 'REWARD',
            status: 'APPROVED',
            description: `Referral reward for rider ${referredRiderId}`,
            approvedAt: clock.now(),
          },
        });

        await walletLedgerService.credit({
          riderId: referrer.id,
          amountInPaise: REWARD_AMOUNT_PAISE,
          category: 'REWARD',
          txnId: txn.id,
          idempotencyKey,
          note: `Referral reward for rider ${referredRiderId}`,
        }, tx);

        await tx.reward.create({
          data: {
            riderId: referrer.id,
            title: `Referral bonus: New rider joined`,
            points: REWARD_AMOUNT_PAISE,
          },
        });
      });

      result.rewardsCredited++;

      createAuditLog({
        actorId: 'system',
        actorType: 'SYSTEM',
        action: 'CREATE',
        entity: 'rider',
        entityId: referrer.id,
        details: JSON.stringify({ amountPaise: REWARD_AMOUNT_PAISE, referredRiderId }),
      }).catch(() => {});

      logger.info('[ReferralRewardJob] Reward credited', {
        referrerId: referrer.id,
        amountPaise: REWARD_AMOUNT_PAISE,
      });
    } catch (err) {
      // P0 fix 2026-09-03: P2002 on the ledger key means the use-case path
      // won the race — the reward WAS paid. Count as credited, not an error.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        logger.info('[ReferralRewardJob] Race lost (P2002), already paid', {
          referrerId: referrer.id,
          referredRiderId,
        });
        result.rewardsCredited++;
        result.referredRiders = 1;
        return result;
      }
      logger.error('[ReferralRewardJob] Failed to credit reward', {
        referrerId: referrer.id,
        referredRiderId,
        err,
      });
      result.errors++;
    }

    result.referredRiders = 1;
    logger.info('[ReferralRewardJob] Complete', result);
    return result;
  },
};
