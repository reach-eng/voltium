/**
 * Wallet module - Repository.
 *
 * Data access for wallet balances, ledger entries, and transaction records.
 * All wallet mutations go through wallet.service.ts (which uses wallet-ledger.service.ts).
 */

import { db } from '@/lib/db';
import { TransactionType, TransactionPurpose, TransactionStatus } from '@prisma/client';

export const walletRepository = {
  async findByRiderId(riderDbId: string) {
    return db.wallet.findUnique({ where: { riderId: riderDbId } });
  },

  async getBalance(riderDbId: string) {
    const wallet = await db.wallet.findUnique({ where: { riderId: riderDbId } });
    return wallet?.balanceInPaise || 0;
  },

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
    amount: number;
    purpose: TransactionPurpose;
    method?: string;
    status?: TransactionStatus;
    proofUrl?: string;
    upiRef?: string;
    idempotencyKey?: string;
    description?: string;
  }) {
    return db.transaction.create({
      data: {
        riderId: data.riderId,
        type: data.type,
        amount: data.amount,
        purpose: data.purpose,
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

  async updateTransactionStatus(txnId: string, status: TransactionStatus, approvedBy?: string) {
    return db.transaction.update({
      where: { id: txnId },
      data: {
        status,
        approvedAt: [
          TransactionStatus.APPROVED as string,
          TransactionStatus.REJECTED as string,
        ].includes(status as string)
          ? new Date()
          : undefined,
        approvedBy: approvedBy || undefined,
      },
    });
  },
};
