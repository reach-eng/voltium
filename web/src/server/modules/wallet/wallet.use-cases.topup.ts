import { db } from '@/lib/db';
import { isDevelopmentEnv } from '@/lib/env';
import { walletRepository } from './wallet.repository';
import { walletLedgerService } from './wallet-ledger.service';
import { notificationService } from '@/lib/notification-service';
import { OutboxService, OutboxEventTypes } from '@/server/workers/outbox';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { TransactionType, TransactionPurpose, TransactionStatus, Prisma } from '@prisma/client';
import { NotFoundError, ValidationError } from "@/lib/api-error";

function deriveIdempotencyKey(riderId: string, purpose: string, amountInPaise: number): string {
  const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
  return `topup:${riderId}:${purpose}:${amountInPaise}:${bucket}`;
}

const TEST_PHONES = ['9876543210', '9999999999', '8888888888', '7788888801'];

export async function _autoApproveTestTopup(
  riderDbId: string,
  transactionId: string,
  amountPaise: number,
  purpose: string
) {
  await db.$transaction(async (tx: any) => {
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
}

export async function requestTopup(
  riderDbId: string,
  amountPaise: number,
  purpose: string,
  method: string,
  metadata?: {
    proofUrl?: string;
    upiRef?: string;
    idempotencyKey?: string;
  }
) {
  const rider = await db.rider.findUnique({
    where: { id: riderDbId },
    select: { id: true, lifecycleStatus: true, phone: true },
  });
  if (!rider) throw new NotFoundError('Rider not found');

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
  const finalPurpose = rank < 8 ? 'SECURITY_DEPOSIT' : purpose || 'TOP_UP';

  const idempotencyKey = deriveIdempotencyKey(riderDbId, finalPurpose, amountPaise);

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
    isDevelopmentEnv() &&
    process.env.ENABLE_DEV_TOOLS === 'true' &&
    process.env.TEST_MODE === 'true' &&
    TEST_PHONES.includes(rider.phone);

  let transaction: any;
  try {
    transaction = await walletRepository.createTransaction({
      riderId: riderDbId,
      type: TransactionType.CREDIT,
      amountInPaise: amountPaise,
      purpose: finalPurpose as TransactionPurpose,
      method,
      status: isTestRider ? TransactionStatus.APPROVED : TransactionStatus.PENDING,
      proofUrl: metadata?.proofUrl,
      upiRef: metadata?.upiRef,
      idempotencyKey,
      description: `${finalPurpose === 'SECURITY_DEPOSIT' ? 'Security Deposit' : 'Wallet Top-up'} of ₹${(amountPaise / 100).toFixed(2)}`,
    });
  } catch (createErr: any) {
    const racedTxn = await walletRepository.findTransactionByKey(idempotencyKey);
    if (racedTxn) {
      logger.info('[WalletUseCases] Idempotent replay on race condition', {
        riderId: riderDbId,
        txnId: racedTxn.id,
        idempotencyKey,
      });
      return racedTxn;
    }
    throw createErr;
  }

  if (isTestRider) {
    await _autoApproveTestTopup(riderDbId, transaction.id, amountPaise, finalPurpose);
  }

  if (!isTestRider && finalPurpose === 'SECURITY_DEPOSIT') {
    const { upsertDepositRecord } = await import('@/server/modules/deposits/deposit.service');
    try {
      await upsertDepositRecord({
        riderId: riderDbId,
        transactionId: transaction.id,
        amountInPaise: amountPaise,
      });
      await db.rider.updateMany({
        where: { id: riderDbId, lifecycleStatus: { in: ['GUARANTOR_APPROVED'] } },
        data: { lifecycleStatus: 'DEPOSIT_PENDING' },
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
}

export async function approveTopup(transactionId: string, adminId: string) {
  const txn = await walletRepository.findTransactionById(transactionId);
  if (!txn) throw new NotFoundError(`Transaction ${transactionId} not found`);
  if (txn.status !== 'PENDING') {
    throw new ValidationError(`Transaction ${transactionId} is already ${txn.status}`);
  }

  const idempotencyKey = `approve:${transactionId}`;

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    if (txn.purpose === 'SECURITY_DEPOSIT') {
      await walletLedgerService.creditSecurityDeposit(
        {
          riderId: txn.riderId,
          amountInPaise: txn.amount,
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
          amountInPaise: txn.amount,
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
    }

    await OutboxService.emit(OutboxEventTypes.WALLET_TOPUP_APPROVED, {
      riderId: txn.riderId,
      transactionId,
      amountPaise: txn.amount,
    }, 3, tx);
  });

  await createAuditLog({
    actorId: adminId,
    action: 'wallet.approve_topup',
    entity: 'transaction',
    entityId: transactionId,
    details: { riderId: txn.riderId, amountPaise: txn.amount },
  });

  await notificationService.createAndSend(
    txn.riderId,
    'Top-up Approved ✅',
    `Your top-up of ₹${(txn.amount / 100).toFixed(2)} has been approved.`,
    'PAYMENT',
    { screen: 'WALLET' }
  );

  logger.info('[WalletUseCases] Topup approved', {
    transactionId,
    adminId,
    amountPaise: txn.amount,
  });
}

export async function rejectTopup(transactionId: string, adminId: string, reason: string) {
  const txn = await walletRepository.findTransactionById(transactionId);
  if (!txn) throw new NotFoundError(`Transaction ${transactionId} not found`);
  if (txn.status !== 'PENDING') {
    throw new ValidationError(`Transaction ${transactionId} is already ${txn.status}`);
  }

  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    await walletRepository.updateTransactionStatus(transactionId, 'REJECTED', adminId, tx);
    await OutboxService.emit(OutboxEventTypes.WALLET_TOPUP_REJECTED, {
      riderId: txn.riderId,
      transactionId,
      amountPaise: txn.amount,
      reason,
    }, 3, tx);
  });

  await createAuditLog({
    actorId: adminId,
    action: 'wallet.reject_topup',
    entity: 'transaction',
    entityId: transactionId,
    details: { riderId: txn.riderId, amountPaise: txn.amount, reason },
  });

  await notificationService.createAndSend(
    txn.riderId,
    'Top-up Rejected ❌',
    `Your top-up of ₹${(txn.amount / 100).toFixed(2)} was rejected: ${reason}`,
    'PAYMENT',
    { screen: 'WALLET' }
  );

  logger.info('[WalletUseCases] Topup rejected', { transactionId, adminId, reason });
}
