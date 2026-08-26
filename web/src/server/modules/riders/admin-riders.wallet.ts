/**
 * Admin Riders — Wallet Operations
 *
 * Handles admin-driven wallet adjustments, ledger mutations, and balance reconciliation.
 */

import { type TxClient } from '@/lib/db';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';

export const WALLET_FIELDS = new Set([
  'securityDeposit',
  'balanceInPaise',
  'depositStatus',
]);

/**
 * Handle balanceInPaise adjustment inside a transaction using ledger service.
 */
export async function applyAdminBalanceAdjustment(
  tx: TxClient,
  riderId: string,
  targetBalanceInPaise: number,
  actorId: string,
  balanceAdjustmentToken?: string | null
): Promise<void> {
  const wallet =
    (await tx.wallet.findUnique({
      where: { riderId },
      select: { id: true, balanceInPaise: true },
    })) ??
    (await tx.wallet.create({
      data: { riderId },
      select: { id: true, balanceInPaise: true },
    }));

  const currentBalance = wallet.balanceInPaise;
  const diff = targetBalanceInPaise - currentBalance;
  const balanceKey =
    balanceAdjustmentToken ?? `adj:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;

  if (diff > 0) {
    await walletLedgerService.credit(
      {
        riderId,
        amountInPaise: diff,
        category: 'ADMIN_ADJUSTMENT',
        actorId,
        idempotencyKey: `admin:${riderId}:balance:${balanceKey}`,
        note: `Admin set balance to ₹${(targetBalanceInPaise / 100).toFixed(2)}`,
      },
      tx
    );
  } else if (diff < 0) {
    await walletLedgerService.debit(
      {
        riderId,
        amountInPaise: Math.abs(diff),
        category: 'ADMIN_ADJUSTMENT',
        actorId,
        idempotencyKey: `admin:${riderId}:balance:${balanceKey}`,
        note: `Admin set balance to ₹${(targetBalanceInPaise / 100).toFixed(2)}`,
        allowNegative: true,
      },
      tx
    );
  }
}
