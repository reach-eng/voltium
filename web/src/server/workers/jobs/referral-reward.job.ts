import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
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

    // Credit reward points to referrer (e.g., ₹100 in paise)
    const REWARD_AMOUNT_PAISE = 10000; // ₹100
    const idempotencyKey = `referral:${referrer.id}:${referredRiderId}`;

    try {
      await db.$transaction(async (tx: any) => {
        const txn = await tx.transaction.create({
          data: {
            riderId: referrer.id,
            type: 'CREDIT',
            amount: REWARD_AMOUNT_PAISE,
            purpose: 'REWARD',
            status: 'APPROVED',
            description: `Referral reward for rider ${referredRiderId}`,
            approvedAt: new Date(),
          },
        });

        await walletLedgerService.credit({
          riderId: referrer.id,
          amountInPaise: REWARD_AMOUNT_PAISE,
          category: 'REWARD',
          txnId: txn.id,
          idempotencyKey,
          note: `Referral reward for rider ${referredRiderId}`,
        });

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
        action: 'finance.referral_reward',
        entity: 'rider',
        entityId: referrer.id,
        details: { amountPaise: REWARD_AMOUNT_PAISE, referredRiderId },
      }).catch(() => {});

      await OutboxService.emit(OutboxEventTypes.REFERRAL_REWARD, {
        referrerId: referrer.id,
        amountPaise: REWARD_AMOUNT_PAISE,
        referredRiderId,
      }).catch(() => {});

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
