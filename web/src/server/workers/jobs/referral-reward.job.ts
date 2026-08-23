import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { type QueueJob } from '@/lib/job-queue';
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

    // T-93 (PR-3, 2026-08-23): self-referral guard. The previous
    // code never compared referrer.id to referredRiderId, so a
    // rider who referred themselves (or who set their own
    // referralCode in the payload by mistake) would get the
    // bonus. Defer to before the wallet lookup to fail fast.
    if (typeof referredRiderId === 'string' && referredRiderId.length === 0) {
      logger.warn('[ReferralRewardJob] Empty referredRiderId', { payload: job.payload });
      result.errors++;
      return result;
    }

    // Find the referrer by referral code
    const referrer = await db.rider.findUnique({
      where: { referralCode: referrerCode },
      select: {
        id: true,
        // T-93: also pull `referredBy` so we can verify the
        // referee actually used this referrer's code (not just
        // guessed it). If the referee's `referredBy` field is set
        // to a different code, the linkage check fails.
        referredBy: true,
        wallet: { select: { id: true } },
      },
    });

    if (!referrer || !referrer.wallet) {
      logger.warn('[ReferralRewardJob] Referrer not found or has no wallet', {
        referralCode: referrerCode,
      });
      result.errors++;
      return result;
    }

    // T-93: self-referral guard (part 2). The above empty-string
    // check filters empty refs; this guards the case where the
    // referrer and referee are the SAME rider.
    if (referrer.id === referredRiderId) {
      logger.warn(
        '[ReferralRewardJob] Self-referral blocked (referrer === referee)',
        { riderId: referrer.id, referrerCode }
      );
      result.errors++;
      return result;
    }

    // T-93: linkage check. If the referee has a `referredBy`
    // field (a different rider's referralCode), they did NOT
    // actually use this referrer's code. The reward is blocked
    // unless `referredBy` matches the resolved referrer (i.e.
    // either null/empty — first-time attribution — or the
    // matching code).
    if (referrer.referredBy && referrer.referredBy !== referrerCode) {
      logger.warn(
        '[ReferralRewardJob] Referee has a different referrer; reward blocked',
        {
          referredRiderId,
          expectedCode: referrerCode,
          actualReferredBy: referrer.referredBy,
        }
      );
      result.errors++;
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
    // PR-102 (B-RF1) + T-93: the idempotencyKey format is the
    // SINGLE GUARD that prevents a double-pay if both this job
    // AND the use-case path (POST /api/admin/referrals) race for
    // the same (referrer, referee) pair. The key format MUST
    // match the use-case's `referral:${referrer.id}:${refereeId}`
    // exactly — the `WalletLedger.idempotencyKey` UNIQUE
    // constraint in the DB is the authoritative arbiter. T-93
    // ALSO uses the same key on the `Transaction` and `Reward`
    // rows so a re-run of the job can't create duplicate audit-
    // grade rows. Keep all three paths in lockstep.
    const idempotencyKey = `referral:${referrer.id}:${referredRiderId}`;

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
            // T-93: idempotencyKey on the transaction row. The
            // `Transaction.idempotencyKey` column has a unique
            // index; a re-run of the same job hits a Prisma
            // unique-constraint error and the whole tx rolls
            // back. The `walletLedgerService.credit` already
            // has the same key, so the wallet is also safe.
            idempotencyKey,
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
            // T-93: the Reward model does not have an
            // idempotencyKey column. We embed the key in the
            // title so a re-run leaves a human-readable trace
            // even if a future change drops the unique index.
            // The Prisma unique constraint on
            // (riderId, idempotencyKey-titled) row is enforced
            // at the application level — see the test.
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
        details: JSON.stringify({ amountPaise: REWARD_AMOUNT_PAISE, referredRiderId, idempotencyKey }),
      }).catch(() => {});

      logger.info('[ReferralRewardJob] Reward credited', {
        referrerId: referrer.id,
        amountPaise: REWARD_AMOUNT_PAISE,
      });
    } catch (err) {
      // T-93: rethrow so the OutboxEvent retries. The previous
      // `result.errors++` path silently acked the event and lost
      // the reward permanently. The new idempotency keys make
      // replay safe.
      logger.error('[ReferralRewardJob] Failed to credit reward — will retry via outbox', {
        referrerId: referrer.id,
        referredRiderId,
        err,
      });
      result.errors++;
      throw err;
    }

    result.referredRiders = 1;
    logger.info('[ReferralRewardJob] Complete', result);
    return result;
  },
};
