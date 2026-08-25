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
    // M-3: Points are stored in paise ("₹200 award → points 20000").
    // Dropping the previous `* 100` multiplication which inflated redemption 100x.
    const amountInPaise = reward.points;

    await db.$transaction(async (tx) => {
      // M-3: CAS claim ensures concurrent requests cannot double-redeem
      const claimed = await tx.reward.updateMany({
        where: { id: rewardId, redeemedAt: null },
        data: { redeemedAt: now },
      });

      if (claimed.count === 0) {
        throw new Error('ALREADY_REDEEMED');
      }

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
        idempotencyKey: `redeem-reward:${rewardId}`,
        note: `Reward redemption: ${reward.title}`,
      }, tx);
    });

    return success({ rewardId, redeemedAt: now.toISOString() }, 'Reward redeemed successfully');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'ALREADY_REDEEMED') {
      return errors.badRequest('Reward already redeemed');
    }
    logger.error('[POST /api/rider/rewards/[id]/redeem]', err);
    return errors.internal('Failed to redeem reward');
  }
}
