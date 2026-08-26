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
} from '@/server/modules/wallet/wallet-service';
import { createAuditLog } from '@/lib/audit-log';
import { lifecycleRankOf } from '@/lib/lifecycle-ranks';
import { transitionRiderStatus } from '@/server/modules/riders/rider-lifecycle.service';
import { fcmService } from '@/lib/fcm';
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DepositStatus =
  | 'PENDING'
  | 'NOT_SUBMITTED'
  | 'PENDING_VERIFICATION'
  | 'APPROVED'
  | 'REJECTED'
  | 'REFUND_REQUESTED'
  | 'REFUNDED'
  | 'FORFEITED'
  | 'PARTIALLY_REFUNDED';

type DepositTransition = 'APPROVE' | 'REJECT' | 'REFUND' | 'FORFEIT';

// Valid transitions: [fromStatus] → allowed actions
const VALID_TRANSITIONS: Record<DepositStatus, DepositTransition[]> = {
  PENDING: ['APPROVE', 'REJECT'],
  NOT_SUBMITTED: [],
  PENDING_VERIFICATION: ['APPROVE', 'REJECT'],
  APPROVED: ['REFUND', 'FORFEIT'],
  PARTIALLY_REFUNDED: ['REFUND', 'FORFEIT'],
  REFUND_REQUESTED: ['REFUND', 'REJECT'],
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

  // W6 / M-2: explicit status guard. The state machine inside the
  // transaction (_getAndValidate) already blocks re-approving an
  // APPROVED deposit, but checking up-front lets us bail without
  // opening a transaction — cleaner logs and a faster 4xx. The
  // idempotency key below is the authoritative guard against the
  // race window between this read and the update inside the tx.
  const existing = await db.depositRecord.findUnique({ where: { riderId } });
  if (!existing) {
    throw new DepositStateError(`No deposit record found for rider ${riderId}`);
  }
  if (existing.status === 'APPROVED') {
    logger.info('[DepositService] approve: deposit already approved, no-op', {
      riderId,
      adminId,
    });
    return;
  }
  if (existing.status !== 'PENDING') {
    throw new DepositStateError(
      `Cannot approve deposit in status ${existing.status}`
    );
  }

  await db.$transaction(async (tx: any) => {
    const record = await _getAndValidate(tx, riderId, 'APPROVE');
    const wallet = await _requireWallet(tx, riderId);

    // W6 / M-2: idempotency key on the security-deposit credit so a
    // retried approve (concurrent admin / partial-failure retry) is a
    // no-op rather than a second increment. The state machine alone
    // blocks a sequential re-approve (APPROVED is not a PENDING target),
    // but it does NOT block a race where two admins click Approve in
    // the same millisecond — both transactions see status='PENDING' and
    // both try to credit. The unique key on WalletLedger.idempotencyKey
    // makes the second one a P2002 → silent idempotent replay.
    const approveKey = `deposit:approve:${record.id}`;

    // Credit the security deposit ledger
    await creditSecurityDeposit(tx, {
      riderId,
      walletId: wallet.id,
      amountInPaise: record.amountInPaise,
      txnId: record.transactionId ?? undefined,
      actorId: adminId,
      note: 'Security deposit approved by admin',
      idempotencyKey: approveKey,
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

    // Mark rider deposit approved via lifecycleStatus if rank < 8
    const currentRider = await tx.rider.findUnique({
      where: { id: riderId },
      select: { lifecycleStatus: true },
    });
    if (currentRider && lifecycleRankOf(currentRider.lifecycleStatus) < 8) {
      await tx.rider.update({
        where: { id: riderId },
        data: { lifecycleStatus: 'DEPOSIT_APPROVED', depositDoneAt: new Date() },
      });
    }

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

  // Send FCM overlay trigger to refresh rider state + wallet
  _notifyDepositApproved(riderId).catch(() => {});

  createAuditLog({
    actorId: adminId,
    action: 'APPROVE',
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
    action: 'REJECT',
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
  refundAmountInPaise?: number; // defaults to full remaining deposit amount
  note?: string;
}): Promise<void> {
  const { riderId, adminId, note } = params;

  await db.$transaction(async (tx: any) => {
    const record = await _getAndValidate(tx, riderId, 'REFUND');
    const wallet = await _requireWallet(tx, riderId);

    const previouslyRefunded = record.refundedAmountInPaise ?? 0;
    const remainingRefundable = Math.max(0, record.amountInPaise - previouslyRefunded);

    const refundAmount = params.refundAmountInPaise ?? remainingRefundable;

    if (refundAmount <= 0) {
      throw new DepositStateError('Refund amount must be greater than 0');
    }

    if (refundAmount > remainingRefundable) {
      throw new DepositStateError(
        `Cannot refund ₹${(refundAmount / 100).toFixed(2)}; maximum remaining refundable deposit is ₹${(remainingRefundable / 100).toFixed(2)}`
      );
    }

    const totalRefundedNow = previouslyRefunded + refundAmount;
    const isFullRefund = totalRefundedNow >= record.amountInPaise;
    const newDepositStatus: DepositStatus = isFullRefund ? 'REFUNDED' : 'PARTIALLY_REFUNDED';

    // Debit securityDeposit ledger
    await debitSecurityDeposit(tx, {
      riderId,
      walletId: wallet.id,
      amountInPaise: refundAmount,
      category: 'REFUND',
      newDepositStatus,
      txnId: record.transactionId ?? undefined,
      actorId: adminId,
      note: note ?? (isFullRefund ? 'Security deposit refunded' : 'Security deposit partially refunded'),
      // W6 / M-2 / W7 / R-6: idempotency key per refund increment
      idempotencyKey: `deposit:refund:${record.id}:${totalRefundedNow}`,
    });

    // Credit general wallet balance (rider gets money back)
    await creditWallet(tx, {
      riderId,
      walletId: wallet.id,
      amountInPaise: refundAmount,
      category: 'REFUND',
      actorId: adminId,
      note: note ?? (isFullRefund ? 'Refund from security deposit' : 'Partial refund from security deposit'),
    });

    const updateResult = await tx.depositRecord.updateMany({
      where: { riderId, status: record.status },
      data: {
        status: newDepositStatus,
        refundedAt: new Date(),
        refundedBy: adminId,
        refundedAmountInPaise: totalRefundedNow,
      },
    });

    if (updateResult.count === 0) {
      throw new DepositStateError(
        `Concurrent modification: deposit record for rider ${riderId} is no longer in status ${record.status}`
      );
    }
  });

  createAuditLog({
    actorId: adminId,
    action: 'REFUND',
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
      // W6 / M-2: idempotency key — a retried FORFEIT is a no-op.
      idempotencyKey: `deposit:forfeit:${record.id}`,
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
    action: 'UPDATE',
    entity: 'depositRecord',
    entityId: riderId,
    details: { riderId, reason, subAction: 'forfeit' },
  }).catch(() => {});

  logger.info('[DepositService] Deposit forfeited', { riderId, adminId, reason });
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Notify the rider's device that deposit was approved, triggering a UI refresh. */
async function _notifyDepositApproved(riderId: string): Promise<void> {
  try {
    const rider = await db.rider.findUnique({
      where: { id: riderId },
      select: { fcmToken: true },
    });
    if (rider?.fcmToken) {
      await fcmService.sendOverlayTrigger(rider.fcmToken, 'DEPOSIT_APPROVED');
    }
  } catch (error) {
    logger.warn('[DepositService] Failed to send FCM deposit notification', { riderId, error });
  }
}

async function _getAndValidate(tx: any, riderId: string, action: DepositTransition) {
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
    select: { id: true, balanceInPaise: true, securityDepositInPaise: true },
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
