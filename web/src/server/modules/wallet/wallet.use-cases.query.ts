import { db } from '@/lib/db';
import { walletRepository } from './wallet.repository';
import type { WalletBalance } from './wallet.types';

export async function getWallet(riderDbId: string): Promise<WalletBalance | null> {
  const wallet = await walletRepository.findByRiderId(riderDbId);
  if (!wallet) return null;

  let pendingTopups = 0;
  if (typeof db.transaction?.aggregate === 'function') {
    const pendingAggregate = await db.transaction.aggregate({
      where: {
        riderId: riderDbId,
        status: 'PENDING',
        type: 'CREDIT',
      },
      _sum: {
        amount: true,
      },
    });
    pendingTopups = pendingAggregate?._sum?.amount ?? 0;
  } else if (typeof walletRepository.getTransactions === 'function') {
    const pendingTxns = await walletRepository.getTransactions(riderDbId, 100);
    pendingTopups = (pendingTxns || [])
      .filter(
        (t: { status: string; type: string; amount: number }) =>
          t.status === 'PENDING' && t.type === 'CREDIT'
      )
      .reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);
  }

  return {
    riderId: wallet.riderId,
    balancePaise: wallet.balanceInPaise,
    pendingTopupsPaise: pendingTopups,
    lastUpdated: new Date(),
  };
}
