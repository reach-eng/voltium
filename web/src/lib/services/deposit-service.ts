/**
 * Deposit Service — manages the full lifecycle of a rider's security deposit.
 *
 * State machine:
 *   PENDING  →  APPROVED   (admin approves; creditSecurityDeposit called)
 *   PENDING  →  REJECTED   (admin rejects; no wallet change)
 *   APPROVED →  REFUNDED   (admin refunds; debitSecurityDeposit + creditWallet called)
 *   APPROVED →  FORFEITED  (admin forfeits; debitSecurityDeposit called, no wallet credit)
 *
 * Invalid transitions throw DepositStateError.
 */

import { db } from '@/lib/db';
import {
  creditSecurityDeposit,
  debitSecurityDeposit,
  creditWallet,
} from '@/lib/services/wallet-service';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DepositStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED' | 'FORFEITED';

type DepositTransition = 'APPROVE' | 'REJECT' | 'REFUND' | 'FORFEIT';

// Valid transitions: [fromStatus] → allowed actions
const VALID_TRANSITIONS: Record<DepositStatus, DepositTransition[]> = {
  PENDING: ['APPROVE', 'REJECT'],
  APPROVED: ['REFUND', 'FORFEIT'],
  REJECTED: [],
  REFUNDED: [],
  FORFEITED: [],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upserts a DepositRecord when a rider submits their first deposit payment.
 * Call this after the Transaction row is created (still PENDING).
 */
export async function upsertDepositRecord(params: {
  riderId: string;
  transactionId: string;
  amountInPaise: number;
}): Promise<void> {
  const { riderId, transactionId, amountInPaise } = params;

  await db.depositRecord.upsert({
    where: { riderId },
    create: {
      riderId,
      transactionId,
      amountInPaise,
      status: 'PENDING',
      paidAt: new Date(),
    },
    update: {
      transactionId,
      amountInPaise,
      status: 'PENDING',
      paidAt: new Date(),
      // Reset rejection/refund fields in case of resubmission after reject
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
    },
  });
}

/**
 * Approves a deposit:
 *  - Validates state transition
 *  - Credits securityDeposit on wallet
 *  - Marks rider.depositDone = true
 *  - Updates DepositRecord
 *  - Optionally credits a bonus amount to balanceInPaise
 */
export async function approveDeposit(params: {
  riderId: string;
  adminId: string;
  bonusAmountInPaise?: number; // optional welcome-bonus credit to general balance
}): Promise<void> {
  const { riderId, adminId, bonusAmountInPaise } = params;

  await db.$transaction(async (tx: any) => {
    const record = await _getAndValidate(tx, riderId, 'APPROVE');
    const wallet = await _requireWallet(tx, riderId);

    // Credit the security deposit ledger
    await creditSecurityDeposit(tx, {
      riderId,
      walletId: wallet.id,
      amountInPaise: record.amountInPaise,
      txnId: record.transactionId ?? undefined,
      actorId: adminId,
      note: 'Security deposit approved by admin',
    });

    // Optional welcome bonus to general balance
    if (bonusAmountInPaise && bonusAmountInPaise > 0) {
      await creditWallet(tx, {
        riderId,
        walletId: wallet.id,
        amountInPaise: bonusAmountInPaise,
        category: 'ADMIN_ADJUSTMENT',
        txnId: record.transactionId ?? undefined,
        actorId: adminId,
        note: 'Welcome bonus on deposit approval',
      });
    }

    // Mark rider depositDone
    await tx.rider.update({
      where: { id: riderId },
      data: { depositDone: true, depositDoneAt: new Date() },
    });

    // Update DepositRecord
    await tx.depositRecord.update({
      where: { riderId },
      data: {
        status: 'APPROVED' as DepositStatus,
        approvedAt: new Date(),
        approvedBy: adminId,
      },
    });

    // Approve the linked Transaction
    if (record.transactionId) {
      await tx.transaction.update({
        where: { id: record.transactionId },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: adminId,
          purpose: 'SECURITY_DEPOSIT',
        },
      });
    }
  });

  createAuditLog({
    actorId: adminId,
    action: 'deposit.approve',
    entity: 'depositRecord',
    entityId: riderId,
    details: { riderId },
  }).catch(() => {});

  logger.info('[DepositService] Deposit approved', { riderId, adminId });
}

/**
 * Rejects a deposit:
 *  - Validates state transition
 *  - No wallet change
 *  - Records rejection reason
 */
export async function rejectDeposit(params: {
  riderId: string;
  adminId: string;
  reason: string;
}): Promise<void> {
  const { riderId, adminId, reason } = params;

  await db.$transaction(async (tx: any) => {
    const record = await _getAndValidate(tx, riderId, 'REJECT');

    await tx.depositRecord.update({
      where: { riderId },
      data: {
        status: 'REJECTED' as DepositStatus,
        rejectedAt: new Date(),
        rejectedBy: adminId,
        rejectionReason: reason,
      },
    });

    if (record.transactionId) {
      await tx.transaction.update({
        where: { id: record.transactionId },
        data: {
          status: 'REJECTED',
          approvedAt: new Date(),
          rejectionReason: reason,
        },
      });
    }
  });

  createAuditLog({
    actorId: adminId,
    action: 'deposit.reject',
    entity: 'depositRecord',
    entityId: riderId,
    details: { riderId, reason },
  }).catch(() => {});

  logger.info('[DepositService] Deposit rejected', { riderId, adminId, reason });
}

/**
 * Refunds a deposit:
 *  - Validates state transition (must be APPROVED)
 *  - Decrements securityDeposit on wallet
 *  - Credits the refund amount back to balanceInPaise (rider gets money back)
 *  - Updates DepositRecord
 */
export async function refundDeposit(params: {
  riderId: string;
  adminId: string;
  refundAmountInPaise?: number; // defaults to full deposit amount
  note?: string;
}): Promise<void> {
  const { riderId, adminId, note } = params;

  await db.$transaction(async (tx: any) => {
    const record = await _getAndValidate(tx, riderId, 'REFUND');
    const wallet = await _requireWallet(tx, riderId);

    const refundAmount = params.refundAmountInPaise ?? record.amountInPaise;

    // Debit securityDeposit ledger
    await debitSecurityDeposit(tx, {
      riderId,
      walletId: wallet.id,
      amountInPaise: refundAmount,
      category: 'REFUND',
      newDepositStatus: 'REFUNDED',
      txnId: record.transactionId ?? undefined,
      actorId: adminId,
      note: note ?? 'Security deposit refunded',
    });

    // Credit general wallet balance (rider gets money back)
    await creditWallet(tx, {
      riderId,
      walletId: wallet.id,
      amountInPaise: refundAmount,
      category: 'REFUND',
      actorId: adminId,
      note: note ?? 'Refund from security deposit',
    });

    await tx.depositRecord.update({
      where: { riderId },
      data: {
        status: 'REFUNDED' as DepositStatus,
        refundedAt: new Date(),
        refundedBy: adminId,
        refundedAmountInPaise: refundAmount,
      },
    });
  });

  createAuditLog({
    actorId: adminId,
    action: 'deposit.refund',
    entity: 'depositRecord',
    entityId: riderId,
    details: { riderId, refundAmountInPaise: params.refundAmountInPaise },
  }).catch(() => {});

  logger.info('[DepositService] Deposit refunded', { riderId, adminId });
}

/**
 * Forfeits a deposit (e.g., vehicle damage, policy violation):
 *  - Validates state transition (must be APPROVED)
 *  - Decrements securityDeposit, does NOT credit balanceInPaise
 *  - Records forfeit reason
 */
export async function forfeitDeposit(params: {
  riderId: string;
  adminId: string;
  reason: string;
}): Promise<void> {
  const { riderId, adminId, reason } = params;

  await db.$transaction(async (tx: any) => {
    const record = await _getAndValidate(tx, riderId, 'FORFEIT');
    const wallet = await _requireWallet(tx, riderId);

    await debitSecurityDeposit(tx, {
      riderId,
      walletId: wallet.id,
      amountInPaise: record.amountInPaise,
      category: 'FORFEITURE',
      newDepositStatus: 'FORFEITED',
      txnId: record.transactionId ?? undefined,
      actorId: adminId,
      note: reason,
    });

    await tx.depositRecord.update({
      where: { riderId },
      data: {
        status: 'FORFEITED' as DepositStatus,
        forfeitedAt: new Date(),
        forfeitedBy: adminId,
        forfeitReason: reason,
      },
    });
  });

  createAuditLog({
    actorId: adminId,
    action: 'deposit.forfeit',
    entity: 'depositRecord',
    entityId: riderId,
    details: { riderId, reason },
  }).catch(() => {});

  logger.info('[DepositService] Deposit forfeited', { riderId, adminId, reason });
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function _getAndValidate(
  tx: any,
  riderId: string,
  action: DepositTransition
) {
  const record = await tx.depositRecord.findUnique({ where: { riderId } });
  if (!record) {
    throw new DepositStateError(`No deposit record found for rider ${riderId}`);
  }

  const allowed = VALID_TRANSITIONS[record.status as DepositStatus] ?? [];
  if (!allowed.includes(action)) {
    throw new DepositStateError(
      `Cannot ${action} a deposit in status ${record.status}. Allowed actions: ${allowed.join(', ') || 'none'}`
    );
  }

  return record;
}

async function _requireWallet(tx: any, riderId: string) {
  const wallet = await tx.wallet.findUnique({
    where: { riderId },
    select: { id: true, balanceInPaise: true, securityDeposit: true },
  });
  if (!wallet) {
    throw new DepositStateError(`Wallet not found for rider ${riderId}`);
  }
  return wallet;
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class DepositStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DepositStateError';
  }
}
