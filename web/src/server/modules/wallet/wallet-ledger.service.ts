/**
 * Wallet Ledger Service — module-level wrapper around src/lib/services/wallet-service.ts
 *
 * Provides a clean module interface for ledger-backed wallet mutations.
 * Every balance change MUST go through this service to ensure:
 *   1. A WalletLedger row is created (append-only audit trail)
 *   2. Idempotency keys prevent double-approval
 *   3. Balance consistency is maintained
 *
 * See docs/STATE_MACHINES.md and docs/WORKFLOWS.md for ledger categories.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

type PrismaTransaction = any;

const txDb = db as any;
import {
  creditWallet as libCreditWallet,
  debitWallet as libDebitWallet,
  creditSecurityDeposit,
  debitSecurityDeposit,
  reverseWalletEntry,
} from '@/server/modules/wallet/wallet.mutations';
import {
  verifyLedgerIntegrity,
  backfillOpeningBalance,
} from '@/server/modules/wallet/wallet.queries';
import { WalletServiceError } from '@/server/modules/wallet/wallet.errors';
import type { LedgerCategory } from '@/server/modules/wallet/wallet.mutations';

export { WalletServiceError };

export type { LedgerCategory };

async function findWallet(riderId: string, tx?: PrismaTransaction) {
  const client = tx ?? db;
  const wallet = await client.wallet.findUnique({ where: { riderId } });
  if (!wallet) throw new WalletServiceError(`Wallet not found for rider ${riderId}`);
  return wallet;
}

export const walletLedgerService = {
  async credit(
    params: {
      riderId: string;
      amountInPaise: number;
      category: LedgerCategory;
      transactionId?: string;
      txnId?: string;
      idempotencyKey?: string;
      actorId?: string;
      note?: string;
    },
    tx?: PrismaTransaction
  ) {
    const wallet = await findWallet(params.riderId, tx);

    const work = (innerTx: PrismaTransaction) =>
      libCreditWallet(innerTx, {
        riderId: params.riderId,
        walletId: wallet.id,
        amountInPaise: params.amountInPaise,
        category: params.category,
        transactionId: params.transactionId ?? params.txnId,
        idempotencyKey: params.idempotencyKey,
        actorId: params.actorId,
        note: params.note,
      });

    const result = tx ? await work(tx) : await txDb.$transaction(work);

    if (!tx) {
      logger.info('[WalletLedgerService] Credit', {
        riderId: params.riderId,
        category: params.category,
        amountInPaise: params.amountInPaise,
        newBalance: result.newBalance,
      });
    }

    return result;
  },

  async debit(
    params: {
      riderId: string;
      amountInPaise: number;
      category: LedgerCategory;
      transactionId?: string;
      txnId?: string;
      idempotencyKey?: string;
      actorId?: string;
      note?: string;
      allowNegative?: boolean;
    },
    tx?: PrismaTransaction
  ) {
    const wallet = await findWallet(params.riderId, tx);

    const work = (innerTx: PrismaTransaction) =>
      libDebitWallet(innerTx, {
        riderId: params.riderId,
        walletId: wallet.id,
        amountInPaise: params.amountInPaise,
        category: params.category,
        transactionId: params.transactionId ?? params.txnId,
        idempotencyKey: params.idempotencyKey,
        actorId: params.actorId,
        note: params.note,
        allowNegative: params.allowNegative,
      });

    const result = tx ? await work(tx) : await txDb.$transaction(work);

    return result;
  },

  async creditSecurityDeposit(
    params: {
      riderId: string;
      amountInPaise: number;
      transactionId?: string;
      txnId?: string;
      actorId?: string;
      note?: string;
    },
    tx?: PrismaTransaction
  ) {
    const wallet = await findWallet(params.riderId, tx);

    const work = (innerTx: PrismaTransaction) =>
      creditSecurityDeposit(innerTx, {
        riderId: params.riderId,
        walletId: wallet.id,
        amountInPaise: params.amountInPaise,
        transactionId: params.transactionId ?? params.txnId,
        actorId: params.actorId,
        note: params.note,
      });

    if (tx) await work(tx);
    else await txDb.$transaction(work);
  },

  async reverse(
    params: {
      riderId: string;
      originalTxnId: string;
      originalAmount: number;
      originalType: 'CREDIT' | 'DEBIT';
      actorId: string;
      reason: string;
    },
    tx?: PrismaTransaction
  ) {
    const wallet = await findWallet(params.riderId, tx);

    const work = (innerTx: PrismaTransaction) =>
      reverseWalletEntry(innerTx, {
        riderId: params.riderId,
        walletId: wallet.id,
        originalTxnId: params.originalTxnId,
        originalAmount: params.originalAmount,
        originalType: params.originalType,
        actorId: params.actorId,
        reason: params.reason,
      });

    if (tx) return work(tx);
    return txDb.$transaction(work);
  },

  /**
   * Verifies ledger integrity for a rider.
   * Compares ledger sum against wallet balance — drift should be 0.
   */
  async verifyIntegrity(riderId: string) {
    return verifyLedgerIntegrity(db, riderId);
  },

  /**
   * Backfills an opening-balance ledger entry for wallets created before the ledger system.
   * Safe to call multiple times (idempotent).
   */
  async backfillOpeningBalance(riderId: string) {
    return backfillOpeningBalance(db, riderId);
  },
};
