/**
 * Wallet module - Use cases.
 *
 * Orchestrates wallet workflows: top-up request, approval, reversal, balance queries.
 * All money mutations go through walletLedgerService which enforces ledger entries and idempotency.
 *
 * Expanded to handle:
 *   - Server-derived idempotency key (5-min bucket)
 *   - Security deposit detection (force SECURITY_DEPOSIT if rider not depositDone)
 *   - Deposit record tracking for security deposits
 *   - Test mode auto-approval
 */

import { db } from '@/lib/db';
import { walletRepository } from './wallet.repository';
import { walletLedgerService } from './wallet-ledger.service';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { TransactionType, TransactionPurpose, TransactionStatus } from '@prisma/client';
import type { WalletBalance } from './wallet.types';

// Server-derived idempotency key (5-minute bucket, no client change required)
function deriveIdempotencyKey(
  riderId: string,
  purpose: string,
  amountInPaise: number
): string {
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  return `topup:${riderId}:${purpose}:${amountInPaise}:${bucket}`;
}

const TEST_PHONES = ['9876543210', '9999999999', '8888888888', '7788888801'];

export const walletUseCases = {
  async getWallet(riderDbId: string): Promise<WalletBalance | null> {
    const wallet = await walletRepository.findByRiderId(riderDbId);
    if (!wallet) return null;

    const pendingTxns = await walletRepository.getTransactions(riderDbId, 100);
    const pendingTopups = pendingTxns
      .filter((t) => t.status === 'PENDING' && t.type === 'CREDIT')
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      riderId: wallet.riderId,
      balancePaise: wallet.balanceInPaise,
      pendingTopupsPaise: pendingTopups,
      lastUpdated: new Date(),
    };
  },

  async requestTopup(riderDbId: string, amountPaise: number, purpose: string, method: string, metadata?: {
    proofUrl?: string;
    upiRef?: string;
    idempotencyKey?: string;
  }) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: { id: true, lifecycleStatus: true, phone: true },
    });
    if (!rider) throw new Error('Rider not found');

    const lifecycleRank: Record<string, number> = {
      NEW: 0, PHONE_VERIFIED: 1, PROFILE_SUBMITTED: 2, KYC_SUBMITTED: 3,
      KYC_APPROVED: 4, GUARANTOR_SUBMITTED: 5, GUARANTOR_APPROVED: 6,
      DEPOSIT_PENDING: 7, DEPOSIT_APPROVED: 8, PLAN_SELECTED: 9,
      PICKUP_SCHEDULED: 10, ACTIVE: 11, SUSPENDED: 12,
      RETURN_PENDING: 13, CLOSED: 14,
    };
    const rank = lifecycleRank[rider.lifecycleStatus] ?? 0;
    const finalPurpose = rank < 8 ? 'SECURITY_DEPOSIT' : (purpose || 'TOP_UP');

    const serverKey = deriveIdempotencyKey(riderDbId, finalPurpose, amountPaise);
    const idempotencyKey = metadata?.idempotencyKey || serverKey;

    const existingTxn = await walletRepository.findTransactionByKey(idempotencyKey);
    if (existingTxn) {
      logger.info('[WalletUseCases] Idempotent replay', {
        riderId: riderDbId,
        txnId: existingTxn.id,
        idempotencyKey,
      });
      return existingTxn;
    }

    const isTestRider =
      process.env.NODE_ENV === 'development' &&
      process.env.ENABLE_DEV_TOOLS === 'true' &&
      process.env.TEST_MODE === 'true' &&
      TEST_PHONES.includes(rider.phone);

    const transaction = await walletRepository.createTransaction({
      riderId: riderDbId,
      type: TransactionType.CREDIT,
      amount: amountPaise,
      purpose: finalPurpose as TransactionPurpose,
      method,
      status: isTestRider ? TransactionStatus.APPROVED : TransactionStatus.PENDING,
      proofUrl: metadata?.proofUrl,
      upiRef: metadata?.upiRef,
      idempotencyKey,
      description: `${finalPurpose === 'SECURITY_DEPOSIT' ? 'Security Deposit' : 'Wallet Top-up'} of ₹${(amountPaise / 100).toFixed(2)}`,
    });

    if (isTestRider) {
      await this._autoApproveTestTopup(riderDbId, transaction.id, amountPaise, finalPurpose);
    }

    if (!isTestRider && finalPurpose === 'SECURITY_DEPOSIT') {
      const { upsertDepositRecord } = await import('@/lib/services/deposit-service');
      try {
        await upsertDepositRecord({
          riderId: riderDbId,
          transactionId: transaction.id,
          amountInPaise: amountPaise,
        });
      } catch (err: unknown) {
        logger.error('[WalletUseCases] Failed to upsert deposit record', err);
      }
    }

    logger.info('[WalletUseCases] Topup requested', {
      riderId: riderDbId,
      txnId: transaction.id,
      amountPaise,
      purpose: finalPurpose,
    });

    return transaction;
  },

  async _autoApproveTestTopup(riderDbId: string, transactionId: string, amountPaise: number, purpose: string) {
    await db.$transaction(async (tx: any) => {
      let wallet = await tx.wallet.findUnique({ where: { riderId: riderDbId }, select: { id: true } });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { riderId: riderDbId },
          select: { id: true },
        });
      }

      if (purpose === 'SECURITY_DEPOSIT') {
        await walletLedgerService.creditSecurityDeposit({
          riderId: riderDbId,
          amountInPaise: amountPaise,
          txnId: transactionId,
          note: 'Test mode: auto-approved security deposit',
        }, tx);
        await walletLedgerService.credit({
          riderId: riderDbId,
          amountInPaise: 800000,
          category: 'ADMIN_ADJUSTMENT',
          txnId: transactionId,
          idempotencyKey: `test:${transactionId}:opening`,
          note: 'Test mode: opening balance',
        }, tx);
        await tx.rider.update({
          where: { id: riderDbId },
          data: { lifecycleStatus: 'DEPOSIT_APPROVED', depositDoneAt: new Date() },
        });
      } else {
        await walletLedgerService.credit({
          riderId: riderDbId,
          amountInPaise: amountPaise,
          category: 'TOP_UP',
          txnId: transactionId,
          idempotencyKey: `test:${transactionId}:topup`,
          note: 'Test mode: auto-approved top-up',
        }, tx);
      }
    });
  },

  async approveTopup(transactionId: string, adminId: string) {
    const txn = await walletRepository.findTransactionById(transactionId);
    if (!txn) throw new Error(`Transaction ${transactionId} not found`);
    if (txn.status !== 'PENDING') {
      throw new Error(`Transaction ${transactionId} is already ${txn.status}`);
    }

    const idempotencyKey = `approve:${transactionId}`;
    await walletLedgerService.credit({
      riderId: txn.riderId,
      amountInPaise: txn.amount,
      category: txn.purpose === 'SECURITY_DEPOSIT' ? 'SECURITY_DEPOSIT' : 'TOP_UP',
      txnId: txn.id,
      idempotencyKey,
      actorId: adminId,
      note: `Admin approved ${txn.purpose.toLowerCase()}`,
    });

    await walletRepository.updateTransactionStatus(transactionId, 'APPROVED', adminId);

    await createAuditLog({
      actorId: adminId,
      action: 'wallet.approve_topup',
      entity: 'transaction',
      entityId: transactionId,
      details: { riderId: txn.riderId, amountPaise: txn.amount },
    });

    logger.info('[WalletUseCases] Topup approved', { transactionId, adminId, amountPaise: txn.amount });
  },

  async rejectTopup(transactionId: string, adminId: string, reason: string) {
    const txn = await walletRepository.findTransactionById(transactionId);
    if (!txn) throw new Error(`Transaction ${transactionId} not found`);
    if (txn.status !== 'PENDING') {
      throw new Error(`Transaction ${transactionId} is already ${txn.status}`);
    }

    await walletRepository.updateTransactionStatus(transactionId, 'REJECTED', adminId);

    await createAuditLog({
      actorId: adminId,
      action: 'wallet.reject_topup',
      entity: 'transaction',
      entityId: transactionId,
      details: { riderId: txn.riderId, amountPaise: txn.amount, reason },
    });

    logger.info('[WalletUseCases] Topup rejected', { transactionId, adminId, reason });
  },

  async reverseTransaction(transactionId: string, adminId: string, reason: string) {
    const txn = await walletRepository.findTransactionById(transactionId);
    if (!txn) throw new Error(`Transaction ${transactionId} not found`);
    if (txn.status !== 'APPROVED') {
      throw new Error(`Cannot reverse transaction ${transactionId} — status is ${txn.status}`);
    }

    const result = await walletLedgerService.reverse({
      riderId: txn.riderId,
      originalTxnId: transactionId,
      originalAmount: txn.amount,
      originalType: txn.type as 'CREDIT' | 'DEBIT',
      actorId: adminId,
      reason,
    });

    await createAuditLog({
      actorId: adminId,
      action: 'wallet.reverse',
      entity: 'transaction',
      entityId: transactionId,
      details: { riderId: txn.riderId, amountPaise: txn.amount, reason },
    });

    return result;
  },
};
