/**
 * Transactions module - Use cases.
 *
 * Orchestrates transaction listing, approval, rejection, and reversal workflows.
 * All wallet mutations go through wallet-ledger.service.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { paiseToRupees } from '@/lib/flatten-rider';
import { lifecycleRankOf } from '@/lib/lifecycle-ranks';
import { MAX_ADMIN_BONUS_CREDIT_RUPEES } from '@/lib/validators';
import { transactionRepository } from './transaction.repository';
import { transactionService } from './transaction.service';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { invalidateRiderCache } from '@/lib/server-cache';
import { invalidateCache } from '@/lib/cache';
import type { TransactionFilter, TransactionApproval } from './transaction.types';

export const transactionUseCases = {
  async list(filters: TransactionFilter) {
    return transactionRepository.list(filters);
  },

  async getById(txnId: string) {
    return transactionRepository.findById(txnId);
  },

  async getByRiderId(
    riderDbId: string,
    page?: number,
    limit?: number,
    // H6-2026-08-13: forwarded to the repo; defaults to 'USER' there.
    audience?: 'USER' | 'SYSTEM' | 'ALL'
  ) {
    return transactionRepository.findByRiderId(
      riderDbId,
      page,
      limit,
      audience
    );
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

    // P0-1 (financial audit): the schema caps walletCreditAmount, but this
    // re-check is the security boundary for non-schema callers (e.g. the
    // bulk route). A single admin action must never credit an unbounded sum.
    if (input.walletCreditAmount && input.walletCreditAmount > MAX_ADMIN_BONUS_CREDIT_RUPEES) {
      throw new TransactionError(
        `Bonus credit cannot exceed ₹${MAX_ADMIN_BONUS_CREDIT_RUPEES.toLocaleString('en-IN')} per transaction`,
        'VALIDATION'
      );
    }

    if (action === 'REVERSE') {
      return this.reverseTransaction(
        transactionId,
        adminId,
        rejectionReason || 'Admin-initiated reversal'
      );
    }

    if (action === 'REJECT') {
      transactionService.validateTransition(txn.status, 'REJECTED');
      // P0-2 (financial audit): CAS claim — if another admin already moved
      // this transaction, updateStatus throws CONFLICT and the route returns 409.
      const result = await transactionRepository.updateStatus(
        transactionId,
        txn.status,
        'REJECTED',
        adminId,
        rejectionReason
      );
      await transactionService.logAction({
        actorId: adminId,
        action: 'transaction.reject',
        transactionId,
        details: { amount: paiseToRupees(txn.amountInPaise), reason: rejectionReason },
      });
      return { ...result, amount: paiseToRupees(result.amountInPaise) };
    }

    // APPROVE path
    transactionService.validateTransition(txn.status, 'APPROVED');

    // P1-13 (financial audit): DEBIT transactions must not be silently
    // approved. The CREDIT branch credits the wallet and the SECURITY_DEPOSIT
    // branch delegates to the deposit module — neither handles a DEBIT, so
    // the old code flipped the status to APPROVED with no wallet effect and
    // an audit trail claiming a settlement that never happened. Debits are
    // settled by the system, not by admin approval.
    if (txn.type === 'DEBIT') {
      throw new TransactionError(
        'Cannot approve a DEBIT transaction — debits are settled automatically',
        'VALIDATION'
      );
    }

    const rider = await db.rider.findUnique({
      where: { id: txn.riderId },
      select: { id: true, lifecycleStatus: true },
    });
    if (!rider) throw new Error('Rider not found');

    // P1-12: shared lifecycle ranking (single source of truth).
    // PR-ONBOARDING-FLOW-2026-08-13: threshold bumped from `rank < 8`
    // to `rank < 10` to match wallet.use-cases.ts. See the comment
    // there for the full rationale — active-path riders at
    // PLAN_SELECTED (rank 9) were getting their deposit misrouted
    // to TOP_UP.
    const rank = lifecycleRankOf(rider.lifecycleStatus);
    const finalPurpose = rank < 10 ? 'SECURITY_DEPOSIT' : txn.purpose;

    // P0-2 (financial audit): CAS-claim FIRST. If another admin moved this
    // transaction in the meantime, updateStatus throws CONFLICT and the route
    // returns 409 before any wallet/deposit side effects occur.
    const result = await transactionRepository.updateStatus(
      transactionId,
      txn.status,
      'APPROVED',
      adminId
    );

    if (finalPurpose === 'SECURITY_DEPOSIT') {
      const depositRecord = await db.depositRecord.findUnique({
        where: { riderId: txn.riderId },
      });

      if (depositRecord && depositRecord.status === 'PENDING') {
        const { depositUseCases } = await import('@/server/modules/deposits/deposit.use-cases');
        await depositUseCases.reviewDeposit(txn.riderId, adminId, {
          action: 'APPROVE',
        });
      } else {
        await walletLedgerService.creditSecurityDeposit({
          riderId: txn.riderId,
          amountInPaise: txn.amountInPaise,
          txnId: transactionId,
          actorId: adminId,
          note: `Security deposit approved: ${finalPurpose}`,
        });
        // PR-AUDIT 2026-08-12 (H3): threshold bumped from `rank < 8`
        // to `rank < 10` to match wallet.use-cases.ts. Active-path
        // riders are at PLAN_SELECTED (rank 9) when they submit the
        // security deposit, and the previous guard skipped the
        // lifecycle bump — so they stayed at PLAN_SELECTED forever,
        // the lifecycle gate re-routed them to `topUpAmount` on every
        // cold start, and they could submit duplicate SECURITY_DEPOSIT
        // transactions. The wallet guard now also covers PLAN_SELECTED
        // (sets it to DEPOSIT_PENDING on submit, rank 7), and this
        // guard now approves the bump up to DEPOSIT_APPROVED (rank 8)
        // for any pre-ACTIVE rider.
        if (rank < 10) {
          await db.rider.update({
            where: { id: txn.riderId },
            data: { lifecycleStatus: 'DEPOSIT_APPROVED', depositDoneAt: new Date() },
          });
        }
      }

      // Optional bonus wallet credit.
      if (input.walletCreditAmount && input.walletCreditAmount > 0) {
        await walletLedgerService.credit({
          riderId: txn.riderId,
          amountInPaise: Math.round(input.walletCreditAmount * 100),
          category: 'ADMIN_ADJUSTMENT',
          txnId: transactionId,
          idempotencyKey: `approve-bonus:${transactionId}`,
          actorId: adminId,
          note: 'Bonus credit on deposit approval',
        });
      }
    } else if (txn.type === 'CREDIT') {
      // General wallet top-up via ledger service (idempotent)
      const idempotencyKey = `approve:${transactionId}`;
      await walletLedgerService.credit({
        riderId: txn.riderId,
        amountInPaise: txn.amountInPaise,
        category: finalPurpose === 'TOP_UP' ? 'TOP_UP' : 'ADMIN_ADJUSTMENT',
        txnId: transactionId,
        idempotencyKey,
        actorId: adminId,
        note: `Top-up approved: ${finalPurpose}`,
      });
    }

    await transactionService.logAction({
      actorId: adminId,
      action: 'transaction.approve',
      transactionId,
      details: { status: 'APPROVED', amount: paiseToRupees(txn.amountInPaise) },
    });

    // Invalidate rider cache & admin rider lists so Rider App & Admin Rider Section update instantly
    invalidateRiderCache(txn.riderId);
    invalidateCache('admin:riders:*');
    invalidateCache('admin:transactions:*');

    return { ...result, amount: paiseToRupees(result.amountInPaise) };
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

    // P0-2: CAS-claim FIRST. reverseWalletEntry has no idempotency guard, so
    // the old credit-then-claim order let two concurrent reversals both write
    // an offsetting ledger entry before either CAS landed. Claiming REVERSED
    // first means the loser gets a 409 before touching the wallet.
    //
    // Residual edge (accepted): if the ledger write below fails AFTER the
    // claim, the status is REVERSED with no offset entry — a manual fix-up,
    // strictly safer than a double-reversal.
    await transactionRepository.updateStatus(transactionId, txn.status, 'REVERSED', adminId);

    const wallet = await db.wallet.findUnique({
      where: { riderId: txn.riderId },
      select: { id: true },
    });
    if (!wallet) throw new Error('Wallet not found for this rider');

    const result = await walletLedgerService.reverse({
      riderId: txn.riderId,
      originalTxnId: transactionId,
      originalAmount: txn.amountInPaise,
      originalType: txn.type as 'CREDIT' | 'DEBIT',
      actorId: adminId,
      reason,
    });

    await transactionService.logAction({
      actorId: adminId,
      action: 'transaction.reverse',
      transactionId,
      details: { amount: paiseToRupees(txn.amountInPaise), reason },
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
