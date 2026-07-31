import { db } from '@/lib/db';
import {
  creditSecurityDeposit,
  debitSecurityDeposit,
  creditWallet,
} from '@/server/modules/wallet/wallet.mutations';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import {
  DepositStatus,
  _notifyDepositStatusChange,
  _getAndValidate,
  _requireWallet,
} from './deposit.helpers';
import { DepositStateError } from './deposit.errors';

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
      rejectedAt: null,
      rejectedBy: null,
      rejectionReason: null,
    },
  });
}

export async function approveDeposit(params: {
  riderId: string;
  adminId: string;
  bonusAmountInPaise?: number;
}): Promise<void> {
  const { riderId, adminId, bonusAmountInPaise } = params;

  await db.$transaction(async (tx: any) => {
    const record = await _getAndValidate(tx, riderId, 'APPROVE');
    const wallet = await _requireWallet(tx, riderId);

    const updatedDep = await tx.depositRecord.updateMany({
      where: { riderId, status: 'PENDING' },
      data: {
        status: 'APPROVED' as DepositStatus,
        approvedAt: new Date(),
        approvedBy: adminId,
      },
    });

    if (updatedDep.count === 0) {
      throw new DepositStateError(`Deposit for rider ${riderId} is not in PENDING state`);
    }

    const idempotencyKey = `deposit:approve:${riderId}:${record.transactionId ?? 'manual'}`;
    await creditSecurityDeposit(tx, {
      riderId,
      walletId: wallet.id,
      amountInPaise: record.amountInPaise,
      txnId: record.transactionId ?? undefined,
      idempotencyKey,
      actorId: adminId,
      note: 'Security deposit approved by admin',
    });

    if (bonusAmountInPaise && bonusAmountInPaise > 0) {
      await creditWallet(tx, {
        riderId,
        walletId: wallet.id,
        amountInPaise: bonusAmountInPaise,
        category: 'ADMIN_ADJUSTMENT',
        txnId: record.transactionId ?? undefined,
        idempotencyKey: `${idempotencyKey}:bonus`,
        actorId: adminId,
        note: 'Welcome bonus on deposit approval',
      });
    }

    await tx.rider.updateMany({
      where: {
        id: riderId,
        lifecycleStatus: {
          in: [
            'NEW', 'PHONE_VERIFIED', 'PROFILE_SUBMITTED',
            'KYC_SUBMITTED', 'KYC_APPROVED',
            'GUARANTOR_SUBMITTED', 'GUARANTOR_APPROVED',
            'DEPOSIT_PENDING', 'PLAN_SELECTED'
          ],
        },
      },
      data: { lifecycleStatus: 'DEPOSIT_APPROVED', depositDoneAt: new Date() },
    });

    if (record.transactionId) {
      await tx.transaction.updateMany({
        where: { id: record.transactionId, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: adminId,
          purpose: 'SECURITY_DEPOSIT',
        },
      });
    }
  });

  _notifyDepositStatusChange(riderId, 'DEPOSIT_APPROVED').catch(() => {});

  createAuditLog({
    actorId: adminId,
    action: 'APPROVE',
    entity: 'depositRecord',
    entityId: riderId,
    details: { riderId },
  }).catch(() => {});

  logger.info('[DepositService] Deposit approved', { riderId, adminId });
}

export async function rejectDeposit(params: {
  riderId: string;
  adminId: string;
  reason: string;
}): Promise<void> {
  const { riderId, adminId, reason } = params;

  await db.$transaction(async (tx: any) => {
    const record = await _getAndValidate(tx, riderId, 'REJECT');

    const updatedDep = await tx.depositRecord.updateMany({
      where: { riderId, status: 'PENDING' },
      data: {
        status: 'REJECTED' as DepositStatus,
        rejectedAt: new Date(),
        rejectedBy: adminId,
        rejectionReason: reason,
      },
    });

    if (updatedDep.count === 0) {
      throw new DepositStateError(`Deposit for rider ${riderId} is not in PENDING state`);
    }

    if (record.transactionId) {
      await tx.transaction.updateMany({
        where: { id: record.transactionId, status: 'PENDING' },
        data: {
          status: 'REJECTED',
          approvedAt: new Date(),
          rejectionReason: reason,
        },
      });
    }
  });

  _notifyDepositStatusChange(riderId, 'DEPOSIT_REJECTED').catch(() => {});

  createAuditLog({
    actorId: adminId,
    action: 'REJECT',
    entity: 'depositRecord',
    entityId: riderId,
    details: { riderId, reason },
  }).catch(() => {});

  logger.info('[DepositService] Deposit rejected', { riderId, adminId, reason });
}

export async function refundDeposit(params: {
  riderId: string;
  adminId: string;
  refundAmountInPaise?: number;
  note?: string;
}): Promise<void> {
  const { riderId, adminId, note } = params;

  await db.$transaction(async (tx: any) => {
    const record = await _getAndValidate(tx, riderId, 'REFUND');
    const wallet = await _requireWallet(tx, riderId);

    const refundAmount = params.refundAmountInPaise ?? record.amountInPaise;

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

    await creditWallet(tx, {
      riderId,
      walletId: wallet.id,
      amountInPaise: refundAmount,
      category: 'REFUND',
      actorId: adminId,
      note: note ?? 'Refund from security deposit',
    });

    await tx.transaction.create({
      data: {
        riderId,
        type: 'CREDIT',
        amountInPaise: refundAmount,
        status: 'APPROVED',
        purpose: 'REFUND',
        approvedAt: new Date(),
        approvedBy: adminId,
        description: note ?? 'Security deposit refund',
      },
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

  _notifyDepositStatusChange(riderId, 'DEPOSIT_REFUNDED').catch(() => {});

  createAuditLog({
    actorId: adminId,
    action: 'REFUND',
    entity: 'depositRecord',
    entityId: riderId,
    details: { riderId, refundAmountInPaise: params.refundAmountInPaise },
  }).catch(() => {});

  logger.info('[DepositService] Deposit refunded', { riderId, adminId });
}

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

    await tx.transaction.create({
      data: {
        riderId,
        type: 'DEBIT',
        amountInPaise: record.amountInPaise,
        status: 'APPROVED',
        purpose: 'SECURITY_DEPOSIT',
        approvedAt: new Date(),
        approvedBy: adminId,
        description: `Deposit forfeited: ${reason}`,
      },
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

  _notifyDepositStatusChange(riderId, 'DEPOSIT_FORFEITED').catch(() => {});

  createAuditLog({
    actorId: adminId,
    action: 'UPDATE',
    entity: 'depositRecord',
    entityId: riderId,
    details: { riderId, reason, subAction: 'forfeit' },
  }).catch(() => {});

  logger.info('[DepositService] Deposit forfeited', { riderId, adminId, reason });
}
