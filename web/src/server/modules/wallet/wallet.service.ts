/**
 * Wallet module - Service.
 *
 * Core wallet operations: balance mutations, ledger entries, idempotency.
 * No route should directly modify wallet balance — all changes pass through here.
 * Delegates to wallet-ledger.service.ts which calls lib/services/wallet-service.ts.
 */

import { walletRepository } from './wallet.repository';
import { walletLedgerService } from './wallet-ledger.service';
import type { LedgerEntryType, LedgerDirection } from './wallet.types';
import type { LedgerCategory } from './wallet-ledger.service';

export const walletService = {
  async creditBalance(riderDbId: string, amountPaise: number, type: LedgerEntryType, metadata?: Record<string, unknown>) {
    // Delegate to wallet-ledger.service which creates ledger entry + updates balance atomically
    const result = await walletLedgerService.credit({
      riderId: riderDbId,
      amountInPaise: amountPaise,
      category: mapLedgerTypeToCategory(type),
      txnId: (metadata?.txnId as string) || undefined,
      idempotencyKey: (metadata?.idempotencyKey as string) || undefined,
      actorId: (metadata?.actorId as string) || undefined,
      note: (metadata?.note as string) || undefined,
    });
    return result.newBalance;
  },

  async debitBalance(riderDbId: string, amountPaise: number, type: LedgerEntryType, metadata?: Record<string, unknown>) {
    const result = await walletLedgerService.debit({
      riderId: riderDbId,
      amountInPaise: amountPaise,
      category: mapLedgerTypeToCategory(type),
      txnId: (metadata?.txnId as string) || undefined,
      idempotencyKey: (metadata?.idempotencyKey as string) || undefined,
      actorId: (metadata?.actorId as string) || undefined,
      note: (metadata?.note as string) || undefined,
      allowNegative: metadata?.allowNegative === true,
    });
    return result.newBalance;
  },

  async getBalance(riderDbId: string) {
    return walletRepository.getBalance(riderDbId);
  },

  async verifyIntegrity(riderDbId: string) {
    return walletLedgerService.verifyIntegrity(riderDbId);
  },

  async backfillOpeningBalance(riderDbId: string) {
    return walletLedgerService.backfillOpeningBalance(riderDbId);
  },
};

/**
 * Maps module-level LedgerEntryType to lib-level LedgerCategory
 */
function mapLedgerTypeToCategory(type: LedgerEntryType): LedgerCategory {
  const map: Record<LedgerEntryType, LedgerCategory> = {
    TOPUP_SUBMITTED: 'TOP_UP',
    TOPUP_APPROVED: 'TOP_UP',
    TOPUP_REJECTED: 'TOP_UP',
    RENT_DEBIT: 'RENT_PAYMENT',
    DEPOSIT_CREDIT: 'SECURITY_DEPOSIT',
    DEPOSIT_REFUND: 'REFUND',
    REWARD_CREDIT: 'REWARD',
    FINE_DEBIT: 'RENT_PAYMENT',
    REVERSAL: 'REVERSAL',
    ADMIN_ADJUSTMENT: 'ADMIN_ADJUSTMENT',
  };
  return map[type] || 'ADMIN_ADJUSTMENT';
}
