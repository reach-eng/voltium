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
import { lifecycleRankOf } from '@/lib/lifecycle-ranks';
import { walletRepository } from './wallet.repository';
import { walletLedgerService } from './wallet-ledger.service';
import { notificationService } from '@/lib/notification-service';
import { OutboxService, OutboxEventTypes } from '@/server/workers/outbox';
import { createAuditLog } from '@/lib/audit-log';
import { WalletServiceError } from './wallet.errors';
// PR-81: removed `import { randomUUID }` — no longer used after
// the 5-min-bucket idempotency key landed.
import { logger } from '@/lib/logger';
import { TransactionType, TransactionPurpose, TransactionStatus, Prisma } from '@prisma/client';
import { invalidateRiderCache } from '@/lib/server-cache';
import type { WalletBalance } from './wallet.types';

const TEST_PHONES = ['9876543210', '9999999999', '8888888888', '7788888801'];

export const walletUseCases = {
  async getWallet(riderDbId: string): Promise<WalletBalance | null> {
    const wallet = await walletRepository.findByRiderId(riderDbId);
    if (!wallet) return null;

    const pendingTxns = await walletRepository.getTransactions(riderDbId, 100);
    // Typed sweep (2026-08-16): the `Transaction` model stores paise in
    // `amountInPaise` — the old `t.amount` annotations were a silent
    // `undefined` (masked by `any`) and would have under-counted pending
    // top-ups in the wallet card.
    const pendingTopups = pendingTxns
      .filter((t) => t.status === 'PENDING' && t.type === 'CREDIT')
      .reduce((sum, t) => sum + t.amountInPaise, 0);

    return {
      riderId: wallet.riderId,
      balancePaise: wallet.balanceInPaise,
      pendingTopupsPaise: pendingTopups,
      lastUpdated: new Date(),
    };
  },

  async requestTopup(
    riderDbId: string,
    amountPaise: number,
    purpose: string,
    method: string,
    metadata?: {
      proofUrl?: string;
      upiRef?: string;
      idempotencyKey?: string;
      gatewayStatus?: 'SUCCESS' | 'FAILURE' | 'PENDING';
      mdrAmount?: number;
    }
  ) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: {
        id: true,
        lifecycleStatus: true,
        phone: true,
        currentPlanId: true,
        advanceRentPaid: true,
        currentPlanRef: {
          select: {
            priceInPaise: true,
            securityDepositInPaise: true,
          },
        },
      },
    });
    if (!rider) throw new Error('Rider not found');

    // P1-12: shared lifecycle ranking (single source of truth).
    // PR-ONBOARDING-FLOW-2026-08-13: threshold bumped from `rank < 8`
    // to `rank < 10`. The old threshold only forced SECURITY_DEPOSIT
    // for riders below DEPOSIT_APPROVED (rank 8). Active-path riders
    // are at PLAN_SELECTED (rank 9) when they submit the security
    // deposit — they have already selected a plan and are past the
    // old DEPOSIT_APPROVED milestone. With `rank < 8`, their deposit
    // was misrouted to TOP_UP (wallet credited instead of security-
    // deposit ledger, no deposit record created). With `rank < 10`,
    // any rider below PICKUP_SCHEDULED who submits a deposit is
    // treated as a security-deposit payment. ACTIVE riders (rank 11+)
    // who submit a deposit are treated as a regular wallet top-up.
    const rank = lifecycleRankOf(rider.lifecycleStatus);
    const finalPurpose = rank < 10 ? 'SECURITY_DEPOSIT' : purpose || 'TOP_UP';

    // Validate onboarding deposit amount matches plan security deposit ± advance rent
    if (rank < 10 && finalPurpose === 'SECURITY_DEPOSIT' && rider.currentPlanRef) {
      const secDeposit = rider.currentPlanRef.securityDepositInPaise ?? 0;
      const rentPrice = rider.currentPlanRef.priceInPaise ?? 0;
      const requiredPaise = rider.advanceRentPaid
        ? (secDeposit + rentPrice)
        : (secDeposit > 0 ? secDeposit : rentPrice);

      if (requiredPaise > 0 && amountPaise !== requiredPaise) {
        throw new WalletServiceError(
          `Security deposit amount must be exactly ₹${(requiredPaise / 100).toFixed(0)} (${rider.advanceRentPaid ? 'Security Deposit + Advance Rent' : 'Security Deposit'})`
        );
      }
    }

    let idempotencyKey = metadata?.idempotencyKey;
    if (!idempotencyKey) {
      // PR-81: implement the documented 5-minute bucket key.
      // The previous `topup:{riderId}:{randomUUID()}` was unique
      // per request, so a network retry created a second PENDING
      // top-up that an admin could double-approve.
      // Bucket size: 5 minutes (300_000 ms).
      const FIVE_MINUTES_MS = 300_000;
      const bucket = Math.floor(Date.now() / FIVE_MINUTES_MS);
      idempotencyKey = `topup:${riderDbId}:${bucket}`;
      logger.warn('[WalletUseCases] Client did not provide idempotencyKey, generated 5-min bucket key', {
        riderId: riderDbId,
        idempotencyKey,
        bucket,
      });
    }

    const existingTxn = await walletRepository.findTransactionByKey(idempotencyKey);
    if (existingTxn) {
      if (existingTxn.status === 'PENDING' &&
          (existingTxn.amountInPaise !== amountPaise || existingTxn.purpose !== finalPurpose)) {
        // PR-ONBOARDING-FLOW-2026-08-13: a rider who taps "Change amount"
        // on the Enter Amount screen and re-submits with a different
        // value used to get a hard `WalletServiceError`. The active path
        // exposes this clearly: the rider is on the Enter Amount
        // screen, picks ₹500, advances to topUpProof, hits Back, picks
        // ₹1,000, re-submits — the second call collides on the 5-min
        // bucket. The old behavior stranded the rider. The new
        // behavior: mark the stale PENDING as CANCELLED, then create
        // the new transaction. The old row stays in the ledger for
        // audit (never deleted); the wallet balance is unchanged
        // because the stale row was PENDING and never credited.
        await db.$transaction(async (tx) => {
          await tx.transaction.update({
            where: { id: existingTxn.id },
            data: {
              status: 'CANCELLED',
              description: `${existingTxn.description} (superseded by a different amount within the 5-min window)`,
            },
          });
          await OutboxService.emit(
            OutboxEventTypes.WALLET_TOPUP_REJECTED,
            {
              riderId: riderDbId,
              transactionId: existingTxn.id,
              amountPaise: existingTxn.amountInPaise,
              reason: 'superseded_by_new_amount',
            },
            3,
            tx
          );
        });
        logger.info('[WalletUseCases] Superseded stale pending transaction', {
          riderId: riderDbId,
          oldTxnId: existingTxn.id,
          oldAmountPaise: existingTxn.amountInPaise,
          newAmountPaise: amountPaise,
          idempotencyKey,
        });
        // Fall through to create the new transaction below.
      } else if (existingTxn.status === 'PENDING') {
        // Same amount, same purpose — idempotent replay.
        logger.info('[WalletUseCases] Idempotent replay', {
          riderId: riderDbId,
          txnId: existingTxn.id,
          idempotencyKey,
        });
        return existingTxn;
      } else {
        // Already approved/rejected/cancelled — the rider is retrying
        // against a finalized row. Tell them instead of silently
        // double-charging.
        throw new WalletServiceError(
          `A ${existingTxn.status.toLowerCase()} transaction for this 5-minute window already exists. Please wait ${Math.max(1, Math.ceil((300_000 - (Date.now() % 300_000)) / 60_000))} minutes or contact support.`
        );
      }
    }

    const isTestRider =
      process.env.NODE_ENV === 'development' &&
      process.env.ENABLE_DEV_TOOLS === 'true' &&
      process.env.TEST_MODE === 'true' &&
      TEST_PHONES.includes(rider.phone);

    const isInstantPayment = method === 'INSTANT';
    const isInstantSuccess = isInstantPayment && (metadata?.gatewayStatus === 'SUCCESS' || metadata?.gatewayStatus === undefined);
    const isInstantFailure = isInstantPayment && metadata?.gatewayStatus === 'FAILURE';

    let initialStatus: TransactionStatus = TransactionStatus.PENDING;
    if (isTestRider || isInstantSuccess) {
      initialStatus = TransactionStatus.APPROVED;
    } else if (isInstantFailure) {
      initialStatus = TransactionStatus.REJECTED;
    }

    const transaction = await walletRepository.createTransaction({
      riderId: riderDbId,
      type: TransactionType.CREDIT,
      amountInPaise: amountPaise,
      purpose: finalPurpose as TransactionPurpose,
      method,
      status: initialStatus,
      proofUrl: metadata?.proofUrl,
      upiRef: metadata?.upiRef,
      idempotencyKey,
      description: `${finalPurpose === 'SECURITY_DEPOSIT' ? 'Security Deposit' : 'Wallet Top-up'} of ₹${(amountPaise / 100).toFixed(2)}`,
    });

    if (isTestRider || isInstantSuccess) {
      await this._autoApproveTestTopup(riderDbId, transaction.id, amountPaise, finalPurpose);
    }

    if (!isTestRider && finalPurpose === 'SECURITY_DEPOSIT') {
      const { upsertDepositRecord } = await import('@/server/modules/deposits/deposit-service');
      try {
        await upsertDepositRecord({
          riderId: riderDbId,
          transactionId: transaction.id,
          amountInPaise: amountPaise,
        });
        // PR-AUDIT 2026-08-12 (H3): include PLAN_SELECTED in the lifecycle
        // bump. The active path puts the rider at PLAN_SELECTED (rank 9)
        // when they submit the security deposit. Without this, a rider who
        // kills the app mid-deposit and re-launches is still at rank 9
        // → the lifecycle gate re-routes them to `topUpAmount` → they
        // submit a SECOND SECURITY_DEPOSIT transaction. Bumping to
        // DEPOSIT_PENDING (rank 7) lets the gate's depositDone check
        // (see rider_lifecycle_gate.dart H3 branch) skip the duplicate
        // request.
        await db.rider.updateMany({
          where: {
            id: riderDbId,
            lifecycleStatus: {
              in: [
                'NEW',
                'PHONE_VERIFIED',
                'PROFILE_SUBMITTED',
                'KYC_SUBMITTED',
                'KYC_APPROVED',
                'GUARANTOR_SUBMITTED',
                'GUARANTOR_APPROVED',
                'PLAN_SELECTED',
              ],
            },
          },
          data: { lifecycleStatus: 'DEPOSIT_PENDING' },
        });
        invalidateRiderCache(riderDbId);
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

  async _autoApproveTestTopup(
    riderDbId: string,
    transactionId: string,
    amountPaise: number,
    purpose: string
  ) {
    await db.$transaction(async (tx) => {
      let wallet = await tx.wallet.findUnique({
        where: { riderId: riderDbId },
        select: { id: true },
      });
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: { riderId: riderDbId },
          select: { id: true },
        });
      }

      if (purpose === 'SECURITY_DEPOSIT') {
        await walletLedgerService.creditSecurityDeposit(
          {
            riderId: riderDbId,
            amountInPaise: amountPaise,
            txnId: transactionId,
            note: 'Test mode: auto-approved security deposit',
          },
          tx
        );
        await walletLedgerService.credit(
          {
            riderId: riderDbId,
            amountInPaise: 800000,
            category: 'ADMIN_ADJUSTMENT',
            txnId: transactionId,
            idempotencyKey: `test:${transactionId}:opening`,
            note: 'Test mode: opening balance',
          },
          tx
        );
        await tx.rider.update({
          where: { id: riderDbId },
          data: { lifecycleStatus: 'DEPOSIT_APPROVED', depositDoneAt: new Date() },
        });
      } else {
        await walletLedgerService.credit(
          {
            riderId: riderDbId,
            amountInPaise: amountPaise,
            category: 'TOP_UP',
            txnId: transactionId,
            idempotencyKey: `test:${transactionId}:topup`,
            note: 'Test mode: auto-approved top-up',
          },
          tx
        );
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

    await db.$transaction(async (tx) => {
      if (txn.purpose === 'SECURITY_DEPOSIT') {
        await walletLedgerService.creditSecurityDeposit(
          {
            riderId: txn.riderId,
            amountInPaise: txn.amountInPaise,
            txnId: txn.id,
            actorId: adminId,
            note: `Admin approved security deposit`,
          },
          tx
        );
      } else {
        await walletLedgerService.credit(
          {
            riderId: txn.riderId,
            amountInPaise: txn.amountInPaise,
            category: 'TOP_UP',
            txnId: txn.id,
            idempotencyKey,
            actorId: adminId,
            note: `Admin approved top up`,
          },
          tx
        );
      }

      await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: adminId || null,
        },
      });

      if (txn.purpose === 'SECURITY_DEPOSIT') {
        await tx.rider.updateMany({
          where: { id: txn.riderId, lifecycleStatus: { in: ['DEPOSIT_PENDING', 'GUARANTOR_APPROVED'] } },
          data: { lifecycleStatus: 'DEPOSIT_APPROVED', depositDoneAt: new Date() },
        });
        invalidateRiderCache(txn.riderId);
      }

      await OutboxService.emit(OutboxEventTypes.WALLET_TOPUP_APPROVED, {
        riderId: txn.riderId,
        transactionId,
        amountPaise: txn.amountInPaise,
      }, 3, tx);
    });

    await createAuditLog({
      actorId: adminId,
      action: 'wallet.approve_topup',
      entity: 'transaction',
      entityId: transactionId,
      details: { riderId: txn.riderId, amountPaise: txn.amountInPaise },
    });

    await notificationService.createAndSend(
      txn.riderId,
      'Top-up Approved ✅',
      `Your top-up of ₹${(txn.amountInPaise / 100).toFixed(2)} has been approved.`,
      'PAYMENT',
      { screen: 'WALLET' }
    );

    logger.info('[WalletUseCases] Topup approved', {
      transactionId,
      adminId,
      amountPaise: txn.amountInPaise,
    });
  },

  async rejectTopup(transactionId: string, adminId: string, reason: string) {
    const txn = await walletRepository.findTransactionById(transactionId);
    if (!txn) throw new Error(`Transaction ${transactionId} not found`);
    if (txn.status !== 'PENDING') {
      throw new Error(`Transaction ${transactionId} is already ${txn.status}`);
    }

    await db.$transaction(async (tx) => {
      await walletRepository.updateTransactionStatus(transactionId, 'REJECTED', adminId, tx);
      await OutboxService.emit(OutboxEventTypes.WALLET_TOPUP_REJECTED, {
        riderId: txn.riderId,
        transactionId,
        amountPaise: txn.amountInPaise,
        reason,
      }, 3, tx);
    });

    await createAuditLog({
      actorId: adminId,
      action: 'wallet.reject_topup',
      entity: 'transaction',
      entityId: transactionId,
      details: { riderId: txn.riderId, amountPaise: txn.amountInPaise, reason },
    });

    await notificationService.createAndSend(
      txn.riderId,
      'Top-up Rejected ❌',
      `Your top-up of ₹${(txn.amountInPaise / 100).toFixed(2)} was rejected: ${reason}`,
      'PAYMENT',
      { screen: 'WALLET' }
    );

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
      originalAmount: txn.amountInPaise,
      originalType: txn.type as 'CREDIT' | 'DEBIT',
      actorId: adminId,
      reason,
    });

    await createAuditLog({
      actorId: adminId,
      action: 'wallet.reverse',
      entity: 'transaction',
      entityId: transactionId,
      details: { riderId: txn.riderId, amountPaise: txn.amountInPaise, reason },
    });

    return result;
  },
};
