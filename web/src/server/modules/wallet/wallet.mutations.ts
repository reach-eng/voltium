import { logger } from '@/lib/logger';
import { WalletServiceError } from './wallet.errors';

export type LedgerCategory =
  | 'TOP_UP'
  | 'SECURITY_DEPOSIT'
  | 'RENT_PAYMENT'
  | 'REWARD'
  | 'REFUND'
  | 'REVERSAL'
  | 'ADMIN_ADJUSTMENT'
  | 'FORFEITURE'
  | 'FINE';

export type WalletEntryType = 'CREDIT' | 'DEBIT';

export interface WalletMutationParams {
  riderId: string;
  walletId: string;
  amountInPaise: number; // always positive
  category: LedgerCategory;
  transactionId?: string; // parent Transaction.id
  txnId?: string; // legacy alias
  idempotencyKey?: string;
  actorId?: string; // admin ID if admin-triggered
  note?: string;
}

export async function creditWallet(
  tx: any,
  params: WalletMutationParams
): Promise<{ newBalance: number; ledgerEntryId: string }> {
  const { riderId, walletId, amountInPaise, category, transactionId, txnId, idempotencyKey, actorId, note } =
    params;
  const resolvedTxnId = transactionId ?? txnId ?? null;

  if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
    throw new WalletServiceError(`creditWallet: amountInPaise must be > 0, got ${amountInPaise}`);
  }

  // Idempotency check — if a ledger entry already exists with this key, return it
  if (idempotencyKey) {
    const existing = await tx.walletLedger.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      logger.info('[WalletService] creditWallet: idempotent replay', { idempotencyKey });
      return { newBalance: existing.balanceAfter, ledgerEntryId: existing.id };
    }
  }

  // Increment wallet balance
  const updatedWallet = await tx.wallet.update({
    where: { id: walletId },
    data: {
      balanceInPaise: { increment: amountInPaise },
      version: { increment: 1 },
    },
    select: { balanceInPaise: true },
  });

  const newBalance = updatedWallet.balanceInPaise;

  // Append ledger entry
  const entry = await tx.walletLedger.create({
    data: {
      walletId,
      riderId,
      transactionId: resolvedTxnId,
      entryType: 'CREDIT' as WalletEntryType,
      category,
      amountInPaise,
      balanceAfter: newBalance,
      idempotencyKey: idempotencyKey ?? null,
      actorId: actorId ?? null,
      note: note ?? null,
    },
    select: { id: true },
  });

  logger.info('[WalletService] creditWallet', {
    riderId,
    category,
    amountInPaise,
    newBalance,
  });

  return { newBalance, ledgerEntryId: entry.id };
}

export async function debitWallet(
  tx: any,
  params: WalletMutationParams & { allowNegative?: boolean }
): Promise<{ newBalance: number; ledgerEntryId: string }> {
  const {
    riderId,
    walletId,
    amountInPaise,
    category,
    transactionId,
    txnId,
    idempotencyKey,
    actorId,
    note,
    allowNegative = false,
  } = params;
  const resolvedTxnId = transactionId ?? txnId ?? null;

  if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
    throw new WalletServiceError(`debitWallet: amountInPaise must be > 0, got ${amountInPaise}`);
  }

  // Idempotency check
  if (idempotencyKey) {
    const existing = await tx.walletLedger.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      logger.info('[WalletService] debitWallet: idempotent replay', { idempotencyKey });
      return { newBalance: existing.balanceAfter, ledgerEntryId: existing.id };
    }
  }

  // Read current balance for pre-check
  const wallet = await tx.wallet.findUnique({
    where: { id: walletId },
    select: { balanceInPaise: true, version: true },
  });
  if (!wallet) throw new WalletServiceError('Wallet not found');

  if (!allowNegative && wallet.balanceInPaise < amountInPaise) {
    throw new WalletServiceError(
      `Insufficient balance: have ${wallet.balanceInPaise} paise, need ${amountInPaise} paise`,
      'INSUFFICIENT_BALANCE'
    );
  }

  // Decrement wallet balance with atomic condition guard
  let newBalance: number;

  if (!allowNegative) {
    const updated = await tx.wallet.updateMany({
      where: { id: walletId, balanceInPaise: { gte: amountInPaise } },
      data: {
        balanceInPaise: { decrement: amountInPaise },
        version: { increment: 1 },
      },
    });

    if (updated.count === 0) {
      const wallet = await tx.wallet.findUnique({
        where: { id: walletId },
        select: { balanceInPaise: true },
      });
      const currentBal = wallet?.balanceInPaise ?? 0;
      throw new WalletServiceError(
        `Insufficient balance: have ${currentBal} paise, need ${amountInPaise} paise`,
        'INSUFFICIENT_BALANCE'
      );
    }

    const walletResult = await tx.wallet.findUnique({
      where: { id: walletId },
      select: { balanceInPaise: true },
    });
    newBalance = walletResult?.balanceInPaise ?? 0;
  } else {
    const updatedWallet = await tx.wallet.update({
      where: { id: walletId },
      data: {
        balanceInPaise: { decrement: amountInPaise },
        version: { increment: 1 },
      },
      select: { balanceInPaise: true },
    });
    newBalance = updatedWallet.balanceInPaise;
  }

  // Append ledger entry
  const entry = await tx.walletLedger.create({
    data: {
      walletId,
      riderId,
      transactionId: resolvedTxnId,
      entryType: 'DEBIT' as WalletEntryType,
      category,
      amountInPaise,
      balanceAfter: newBalance,
      idempotencyKey: idempotencyKey ?? null,
      actorId: actorId ?? null,
      note: note ?? null,
    },
    select: { id: true },
  });

  logger.info('[WalletService] debitWallet', {
    riderId,
    category,
    amountInPaise,
    newBalance,
  });

  return { newBalance, ledgerEntryId: entry.id };
}

export async function creditSecurityDeposit(
  tx: any,
  params: {
    riderId: string;
    walletId: string;
    amountInPaise: number;
    transactionId?: string;
    txnId?: string;
    idempotencyKey?: string;
    actorId?: string;
    note?: string;
  }
): Promise<void> {
  const { riderId, walletId, amountInPaise, transactionId, txnId, idempotencyKey, actorId, note } = params;
  const resolvedTxnId = transactionId ?? txnId ?? null;

  if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
    throw new WalletServiceError(`creditSecurityDeposit: amountInPaise must be > 0, got ${amountInPaise}`);
  }

  if (idempotencyKey) {
    const existing = await tx.walletLedger.findFirst({
      where: { idempotencyKey },
    });
    if (existing) {
      logger.info('[WalletService] creditSecurityDeposit: idempotent replay', { idempotencyKey });
      return;
    }
  }

  await tx.wallet.update({
    where: { id: walletId },
    data: {
      securityDepositInPaise: { increment: amountInPaise },
      depositStatus: 'APPROVED',
      version: { increment: 1 },
    },
  });

  await tx.walletLedger.create({
    data: {
      walletId,
      riderId,
      transactionId: resolvedTxnId,
      entryType: 'CREDIT',
      category: 'SECURITY_DEPOSIT',
      amountInPaise,
      balanceAfter: 0, // deposit is tracked separately, not in balanceInPaise
      idempotencyKey: idempotencyKey ?? null,
      actorId: actorId ?? null,
      note: note ?? 'Security deposit approved',
    },
  });
}

export async function debitSecurityDeposit(
  tx: any,
  params: {
    riderId: string;
    walletId: string;
    amountInPaise: number;
    category: 'REFUND' | 'FORFEITURE';
    newDepositStatus: 'REFUNDED' | 'FORFEITED';
    transactionId?: string;
    txnId?: string;
    actorId?: string;
    note?: string;
  }
): Promise<void> {
  const { riderId, walletId, amountInPaise, category, newDepositStatus, transactionId, txnId, actorId, note } =
    params;
  const resolvedTxnId = transactionId ?? txnId ?? null;

  if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
    throw new WalletServiceError(`debitSecurityDeposit: amountInPaise must be > 0, got ${amountInPaise}`);
  }

  await tx.wallet.update({
    where: { id: walletId },
    data: {
      securityDepositInPaise: { decrement: amountInPaise },
      depositStatus: newDepositStatus,
      version: { increment: 1 },
    },
  });

  await tx.walletLedger.create({
    data: {
      walletId,
      riderId,
      transactionId: resolvedTxnId,
      entryType: 'DEBIT',
      category,
      amountInPaise,
      balanceAfter: 0,
      actorId: actorId ?? null,
      note: note ?? `Security deposit ${category.toLowerCase()}`,
    },
  });
}

export async function reverseWalletEntry(
  tx: any,
  params: {
    riderId: string;
    walletId: string;
    originalTxnId: string;
    originalAmount: number; // paise
    originalType: 'CREDIT' | 'DEBIT'; // the direction of the original
    actorId: string;
    reason: string;
  }
): Promise<{ reversalTxnId: string; newBalance: number }> {
  const { riderId, walletId, originalTxnId, originalAmount, originalType, actorId, reason } =
    params;

  // Create a reversal Transaction record
  const reversalTxn = await tx.transaction.create({
    data: {
      riderId,
      type: originalType === 'CREDIT' ? 'DEBIT' : 'CREDIT',
      amountInPaise: originalAmount,
      purpose: 'REVERSAL',
      status: 'APPROVED',
      reversedTxnId: originalTxnId,
      description: `Reversal of txn ${originalTxnId}: ${reason}`,
      approvedBy: actorId,
      approvedAt: new Date(),
    },
    select: { id: true },
  });

  // Apply the offsetting balance change
  if (originalType === 'CREDIT') {
    // Original was a credit → reversal is a debit
    const result = await debitWallet(tx, {
      riderId,
      walletId,
      amountInPaise: originalAmount,
      category: 'REVERSAL',
      txnId: reversalTxn.id,
      actorId,
      note: reason,
      allowNegative: true, // reversals may create negative balance temporarily
    });
    return { reversalTxnId: reversalTxn.id, newBalance: result.newBalance };
  } else {
    // Original was a debit → reversal is a credit
    const result = await creditWallet(tx, {
      riderId,
      walletId,
      amountInPaise: originalAmount,
      category: 'REVERSAL',
      txnId: reversalTxn.id,
      actorId,
      note: reason,
    });
    return { reversalTxnId: reversalTxn.id, newBalance: result.newBalance };
  }
}
