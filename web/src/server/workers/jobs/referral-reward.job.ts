import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { OutboxService, OutboxEventTypes } from '../outbox';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { createAuditLog } from '@/lib/audit-log';

interface ReferralRewardResult {
  referredRiders: number;
  rewardsCredited: number;
  errors: number;
}

export const referralRewardJob = {
  async process(job: any): Promise<ReferralRewardResult> {
    logger.info('[ReferralRewardJob] Starting', { jobId: job.id, payload: job.payload });

    const result: ReferralRewardResult = { referredRiders: 0, rewardsCredited: 0, errors: 0 };

    // Find riders who were referred but haven't had rewards processed yet
    // This runs on-demand when a new rider signs up with a referral code
    const referredRiderId = job.payload?.referredRiderId;
    const referrerCode = job.payload?.referralCode;

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

    // PR-77: read reward amount from settings so the use-case path
    // and the job path pay the same amount. The previous hardcoded
    // ₹100 (10000 paise) was lower than the use-case's default
    // ₹200 (20000 paise), creating a divergence if both paths
    // were ever wired. Default to 20000 paise (₹200) to match.
    const rewardSetting = await db.systemSetting.findUnique({ where: { key: 'referralBonus' } });
    const REWARD_AMOUNT_PAISE = rewardSetting ? parseInt(rewardSetting.value) || 20000 : 20000;
    const idempotencyKey = `referral:${referrer.id}:${referredRiderId}`;

    try {
      await db.$transaction(async (tx: any) => {
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
        action: 'CREATE',
        entity: 'rider',
        entityId: referrer.id,
        details: { amountPaise: REWARD_AMOUNT_PAISE, referredRiderId },
      }).catch(() => {});

      // PR-75: referral reward is interactive.
      await OutboxService.emit(
        OutboxEventTypes.REFERRAL_REWARD,
        {
          referrerId: referrer.id,
          amountPaise: REWARD_AMOUNT_PAISE,
          referredRiderId,
        },
        3,
        undefined,
        'interactive'
      ).catch(() => {});

      logger.info('[ReferralRewardJob] Reward credited', {
        referrerId: referrer.id,
        amountPaise: REWARD_AMOUNT_PAISE,
      });
    } catch (err) {
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
