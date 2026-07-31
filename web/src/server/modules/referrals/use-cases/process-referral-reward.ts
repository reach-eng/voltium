import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { createAuditLog } from '@/lib/audit-log';

/**
 * Processes a referral reward when a new rider signs up with a referral code.
 * Credits the referrer's wallet via the referral reward mechanism.
 * Idempotent — checks for existing transactions before awarding.
 */
export async function processReferralReward(refereeId: string, referrerCode: string) {
  const referrer = await db.rider.findUnique({ where: { referralCode: referrerCode } });
  const referee = await db.rider.findUnique({ where: { id: refereeId } });

  if (!referrer || !referee) {
    logger.warn('[Referral] Invalid referral data', { refereeId, referrerCode });
    return;
  }

  // Check if already rewarded (idempotency)
  const existingReward = await db.transaction.findFirst({
    where: { riderId: referrer.id, purpose: 'REWARD', description: { contains: referee.id } },
  });
  if (existingReward) {
    logger.info('[Referral] Reward already processed', { referrerId: referrer.id, refereeId });
    return;
  }

  // Read referral bonus from settings
  const setting = await db.systemSetting.findFirst({ where: { key: 'referralBonus' } });
  const bonus = parseInt(setting?.value || '200');

  const bonusPaise = bonus * 100;
  const idempotencyKey = `referral:${referrer.id}:${refereeId}`;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const wallet = await tx.wallet.findUnique({
      where: { riderId: referrer.id },
      select: { id: true },
    });

    if (!wallet) {
      logger.warn('[Referral] No wallet for referrer', { referrerId: referrer.id });
      return;
    }

    const txn = await tx.transaction.create({
      data: {
        riderId: referrer.id,
        amountInPaise: bonusPaise,
        type: 'CREDIT',
        purpose: 'REWARD',
        status: 'APPROVED',
        description: `Referral reward for ${referee.fullName || referee.phone}`,
        approvedAt: new Date(),
      },
    });

    await walletLedgerService.credit({
      riderId: referrer.id,
      amountInPaise: bonusPaise,
      category: 'REWARD',
      txnId: txn.id,
      idempotencyKey,
      note: `Referral reward for ${referee.fullName || referee.phone}`,
    });

    await tx.reward.create({
      data: {
        riderId: referrer.id,
        title: `Referral bonus: ${referee.fullName || referee.phone} joined`,
        points: bonusPaise,
      },
    });
  });

  createAuditLog({
    actorId: 'system',
    action: 'finance.referral_reward',
    entity: 'rider',
    entityId: referrer.id,
    details: { amountPaise: bonusPaise, refereeId },
  }).catch(() => {});

  logger.info('[Referral] Reward processed', {
    referrerId: referrer.id,
    refereeId,
    bonus,
  });
}
