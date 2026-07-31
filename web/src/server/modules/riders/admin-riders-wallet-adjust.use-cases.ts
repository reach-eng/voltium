/**
 * Admin Riders — Wallet Adjustment
 *
 * Wallet field allowlists and ledger-backed wallet mutation logic.
 * All wallet mutations go through wallet-service (ledger-backed).
 */

import { Prisma } from '@prisma/client';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { ValidationError } from "@/lib/api-error";

export const WALLET_FIELDS = new Set([
  'walletBalance',
  'securityDeposit',
  'balanceInPaise',
  'depositStatus',
]);

/**
 * Partition incoming data into wallet-specific fields.
 * Converts display values (rupees) to storage values (paise) where needed.
 */
export function extractWalletData(data: Record<string, unknown>): Record<string, unknown> {
  const walletData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!WALLET_FIELDS.has(key)) continue;
    if (key === 'walletBalance') {
      walletData.balanceInPaise = Math.round(Number(value) * 100);
    } else if (key === 'securityDeposit') {
      walletData.securityDeposit = Math.round(Number(value) * 100);
    } else {
      walletData[key] = value;
    }
  }
  return walletData;
}

/**
 * Apply wallet adjustments within an existing transaction.
 *
 * Handles:
 * - Balance changes via the ledger service (credit / debit)
 * - Blocking direct securityDeposit / depositStatus mutations
 *
 * The caller must provide the Prisma transaction client (`tx`).
 */
export async function adjustWalletInTransaction(
  tx: Prisma.TransactionClient,
  riderId: string,
  walletData: Record<string, unknown>,
  actorId: string
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

  if ('balanceInPaise' in walletData) {
    const targetBalance = walletData.balanceInPaise as number;
    const currentBalance = wallet.balanceInPaise;
    const diff = targetBalance - currentBalance;

    if (diff > 0) {
      await walletLedgerService.credit(
        {
          riderId,
          amountInPaise: diff,
          category: 'ADMIN_ADJUSTMENT',
          actorId,
          idempotencyKey: `admin:${riderId}:balance:${targetBalance}`,
          note: `Admin set balance to ₹${(targetBalance / 100).toFixed(2)}`,
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
          idempotencyKey: `admin:${riderId}:balance:${targetBalance}`,
          note: `Admin set balance to ₹${(targetBalance / 100).toFixed(2)}`,
          allowNegative: true,
        },
        tx
      );
    }
    delete walletData.balanceInPaise;
  }

  // Block direct securityDeposit/depositStatus mutations — must use Deposits API
  if ('securityDeposit' in walletData || 'depositStatus' in walletData) {
    throw new ValidationError('Use the Deposits API to modify security deposit or deposit status');
  }

  if (Object.keys(walletData).length > 0) {
    await tx.wallet.update({ where: { id: wallet.id }, data: walletData });
  }
}
