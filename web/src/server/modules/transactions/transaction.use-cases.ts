/**
 * Transactions module - Use cases.
 *
 * Orchestrates transaction listing, approval, rejection, and reversal workflows.
 * All wallet mutations go through wallet-ledger.service.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { paiseToRupees } from '@/lib/flatten-rider';
import { transactionRepository } from './transaction.repository';
import { transactionService } from './transaction.service';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import type { TransactionFilter, TransactionApproval } from './transaction.types';

export const transactionUseCases = {
  async list(filters: TransactionFilter) {
    return transactionRepository.list(filters);
  },

  async getById(txnId: string) {
    return transactionRepository.findById(txnId);
  },

  async getByRiderId(riderDbId: string, page?: number, limit?: number) {
    return transactionRepository.findByRiderId(riderDbId, page, limit);
  },

  async deleteHistory(riderDbId: string) {
    return transactionRepository.deleteByRiderId(riderDbId);
  },

  /**
   * Approve or reject a pending transaction.
   * For APPROVE: credits wallet via wallet-ledger (idempotent).
   * For REJECT: updates status to REJECTED, no wallet change.
   * For SECURITY_DEPOSIT purposes, delegates to deposit-ledger.service.
   */
  async approveTransaction(input: TransactionApproval & { adminId: string }) {
    const { transactionId, action, rejectionReason, adminId } = input;
    const txn = await transactionService.requireTransaction(transactionId);

    if (action === 'REVERSE') {
      return this.reverseTransaction(
        transactionId,
        adminId,
        rejectionReason || 'Admin-initiated reversal'
      );
    }

    if (action === 'REJECT') {
      transactionService.validateTransition(txn.status, 'REJECTED');
      const result = await transactionRepository.updateStatus(
        transactionId,
        'REJECTED',
        adminId,
        rejectionReason
      );
      await transactionService.logAction({
        actorId: adminId,
        action: 'transaction.reject',
        transactionId,
        details: { amount: paiseToRupees(txn.amount), reason: rejectionReason },
      });
      return { ...result, amount: paiseToRupees(result.amount) };
    }

    // APPROVE path
    transactionService.validateTransition(txn.status, 'APPROVED');

    const rider = await db.rider.findUnique({
      where: { id: txn.riderId },
      select: { id: true, lifecycleStatus: true },
    });
    if (!rider) throw new Error('Rider not found');

    const lifecycleRank: Record<string, number> = {
      NEW: 0,
      PHONE_VERIFIED: 1,
      PROFILE_SUBMITTED: 2,
      KYC_SUBMITTED: 3,
      KYC_APPROVED: 4,
      GUARANTOR_SUBMITTED: 5,
      GUARANTOR_APPROVED: 6,
      DEPOSIT_PENDING: 7,
      DEPOSIT_APPROVED: 8,
      PLAN_SELECTED: 9,
      PICKUP_SCHEDULED: 10,
      ACTIVE: 11,
      SUSPENDED: 12,
      RETURN_PENDING: 13,
      CLOSED: 14,
    };
    const rank = lifecycleRank[rider.lifecycleStatus] ?? 0;
    const finalPurpose = rank < 8 ? 'SECURITY_DEPOSIT' : txn.purpose;

    if (finalPurpose === 'SECURITY_DEPOSIT') {
      // Delegate deposit approval to the deposit module
      const { depositUseCases } = await import('@/server/modules/deposits/deposit.use-cases');
      await depositUseCases.reviewDeposit(txn.riderId, adminId, {
        action: 'APPROVE',
      });

      // Optional bonus wallet credit
      if (input.walletCreditAmount && input.walletCreditAmount > 0) {
        await walletLedgerService.credit({
          riderId: txn.riderId,
          amountInPaise: Math.round(input.walletCreditAmount * 100),
          category: 'ADMIN_ADJUSTMENT',
          txnId: transactionId,
          actorId: adminId,
          note: 'Bonus credit on deposit approval',
        });
      }
    } else if (txn.type === 'CREDIT') {
      // General wallet top-up via ledger service (idempotent)
      const idempotencyKey = `approve:${transactionId}`;
      await walletLedgerService.credit({
        riderId: txn.riderId,
        amountInPaise: txn.amount,
        category: finalPurpose === 'TOP_UP' ? 'TOP_UP' : 'ADMIN_ADJUSTMENT',
        txnId: transactionId,
        idempotencyKey,
        actorId: adminId,
        note: `Top-up approved: ${finalPurpose}`,
      });
    }

    const result = await transactionRepository.updateStatus(transactionId, 'APPROVED', adminId);
    await transactionService.logAction({
      actorId: adminId,
      action: 'transaction.approve',
      transactionId,
      details: { status: 'APPROVED', amount: paiseToRupees(txn.amount) },
    });

    return { ...result, amount: paiseToRupees(result.amount) };
  },

  /**
   * Reverse an approved transaction with an offsetting ledger entry.
   */
  async reverseTransaction(transactionId: string, adminId: string, reason: string) {
    const txn = await transactionService.requireTransaction(transactionId);
    transactionService.validateTransition(txn.status, 'REVERSED');

    if (txn.purpose === 'SECURITY_DEPOSIT') {
      throw new TransactionError(
        'Security deposits must be reversed via the Deposits API (REFUND or FORFEIT actions).',
        'DEPOSIT_REVERSION'
      );
    }

    const wallet = await db.wallet.findUnique({
      where: { riderId: txn.riderId },
      select: { id: true },
    });
    if (!wallet) throw new Error('Wallet not found for this rider');

    const result = await walletLedgerService.reverse({
      riderId: txn.riderId,
      originalTxnId: transactionId,
      originalAmount: txn.amount,
      originalType: txn.type as 'CREDIT' | 'DEBIT',
      actorId: adminId,
      reason,
    });

    await transactionRepository.updateStatus(transactionId, 'REVERSED', adminId);
    await transactionService.logAction({
      actorId: adminId,
      action: 'transaction.reverse',
      transactionId,
      details: { amount: paiseToRupees(txn.amount), reason },
    });

    return { id: transactionId, status: 'REVERSED' as const };
  },
};

export class TransactionError extends Error {
  code: string;
  constructor(message: string, code = 'TRANSACTION_ERROR') {
    super(message);
    this.name = 'TransactionError';
    this.code = code;
  }
}
