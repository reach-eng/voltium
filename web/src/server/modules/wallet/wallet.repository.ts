/**
 * Wallet module - Repository.
 *
 * Data access for wallet balances, ledger entries, and transaction records.
 * All wallet mutations go through wallet.service.ts (which uses wallet-ledger.service.ts).
 */

import { db, type TxClient } from '@/lib/db';
import { TransactionType, TransactionPurpose, TransactionStatus, TransactionAudience } from '@prisma/client';

// H6-2026-08-13: centralized audience assignment. Any purpose not in
// this set defaults to SYSTEM via the schema default; SYSTEM is also
// the safe default for new purposes added later.
const USER_AUDIENCE_PURPOSES: ReadonlySet<TransactionPurpose> = new Set([
  TransactionPurpose.TOP_UP,
  TransactionPurpose.SECURITY_DEPOSIT,
]);

function audienceFor(purpose: TransactionPurpose): TransactionAudience {
  return USER_AUDIENCE_PURPOSES.has(purpose)
    ? TransactionAudience.USER
    : TransactionAudience.SYSTEM;
}

export const walletRepository = {
  async findByRiderId(riderDbId: string) {
    return db.wallet.findUnique({ where: { riderId: riderDbId } });
  },

  async getBalance(riderDbId: string) {
    const wallet = await db.wallet.findUnique({ where: { riderId: riderDbId } });
    return wallet?.balanceInPaise || 0;
  },

  /**
   * @deprecated Dead code — no callers as of 2026-08-04. Wallet balance
   * mutations go through walletService.creditWallet / debitWallet which
   * use optimistic-locking $transaction blocks. Direct calls to
   * updateBalance bypass the ledger and can corrupt the reconciliation
   * invariant. Kept for backwards compatibility; remove in v0.4.
   */
  async updateBalance(riderDbId: string, balanceInPaise: number) {
    return db.wallet.upsert({
      where: { riderId: riderDbId },
      create: { riderId: riderDbId, balanceInPaise },
      update: { balanceInPaise },
    });
  },

  async getTransactions(riderDbId: string, limit = 20) {
    return db.transaction.findMany({
      where: { riderId: riderDbId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async getLedgerEntries(riderDbId: string, limit = 50) {
    return db.walletLedger.findMany({
      where: { riderId: riderDbId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },

  async createTransaction(data: {
    riderId: string;
    type: TransactionType;
    amount?: number;
    amountInPaise?: number;
    purpose: TransactionPurpose;
    method?: string;
    status?: TransactionStatus;
    proofUrl?: string;
    upiRef?: string;
    idempotencyKey?: string;
    description?: string;
  }) {
    const finalAmount = data.amountInPaise ?? data.amount ?? 0;
    return db.transaction.create({
      data: {
        riderId: data.riderId,
        type: data.type,
        amountInPaise: finalAmount,
        purpose: data.purpose,
        // H6-2026-08-13: stamp audience at write time. Top-ups and
        // security deposits are rider-initiated (USER); everything else
        // is system (rent, rewards, reversals, admin adjustments, etc.)
        // and stays out of the rider's history endpoint by default.
        audience: audienceFor(data.purpose),
        method: data.method || null,
        status: data.status || TransactionStatus.PENDING,
        proofUrl: data.proofUrl || null,
        upiRef: data.upiRef || null,
        idempotencyKey: data.idempotencyKey || null,
        description: data.description || null,
      },
    });
  },

  async findTransactionById(txnId: string) {
    return db.transaction.findUnique({ where: { id: txnId } });
  },

  async findTransactionByKey(idempotencyKey: string) {
    return db.transaction.findUnique({ where: { idempotencyKey } });
  },

  async updateTransactionStatus(
    txnId: string,
    status: TransactionStatus,
    approvedBy?: string,
    tx?: TxClient
  ) {
    const client = tx || db;
    return client.transaction.update({
      where: { id: txnId },
      data: {
        status,
        // P1-16/17 (financial audit, same defect as transaction.repository):
        // approvedAt must only be stamped on an actual approval. REJECTED used
        // to get an approvedAt too (the schema name lied), and it was never
        // cleared on PENDING/REJECTED/FAILED. REVERSED/REFUNDED keep the
        // original approval time; everything else is cleared.
        approvedAt:
          status === TransactionStatus.APPROVED
            ? new Date()
            : status === TransactionStatus.REVERSED ||
                status === TransactionStatus.REFUNDED
              ? undefined
              : null,
        approvedBy: approvedBy || undefined,
      },
    });
  },
};
