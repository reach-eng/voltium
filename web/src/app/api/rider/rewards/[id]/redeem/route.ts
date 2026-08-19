import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRiderSession } from '@/lib/rider-auth';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    const { id: rewardId } = await params;
    if (!rewardId) {
      return errors.badRequest('Reward ID is required');
    }

    const reward = await db.reward.findUnique({ where: { id: rewardId } });
    if (!reward) {
      return errors.notFound('Reward not found');
    }

    if (reward.riderId !== auth.riderDbId) {
      return errors.forbidden('Unauthorized access to reward');
    }

    if (reward.redeemedAt != null) {
      return errors.badRequest('Reward already redeemed');
    }

    const now = new Date();
    const amountInPaise = reward.points * 100;

    await db.$transaction(async (tx) => {
      await tx.reward.update({
        where: { id: rewardId },
        data: { redeemedAt: now },
      });

      const txn = await tx.transaction.create({
        data: {
          riderId: auth.riderDbId,
          type: 'CREDIT',
          amountInPaise,
          purpose: 'REWARD',
          status: 'APPROVED',
          description: `Reward redemption: ${reward.title}`,
        },
      });

      await walletLedgerService.credit({
        riderId: auth.riderDbId,
        amountInPaise,
        category: 'REWARD',
        txnId: txn.id,
        note: `Reward redemption: ${reward.title}`,
      }, tx);
    });

    return success({ rewardId, redeemedAt: now.toISOString() }, 'Reward redeemed successfully');
  } catch (err: unknown) {
    logger.error('[POST /api/rider/rewards/[id]/redeem]', err);
    return errors.internal('Failed to redeem reward');
  }
}
