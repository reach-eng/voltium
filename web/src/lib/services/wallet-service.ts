/**
 * Wallet Service — the SINGLE gateway for all wallet balance mutations.
 *
 * Rules:
 *  - NO other file may call wallet.update({ balanceInPaise: ... }) directly.
 *  - Every credit/debit MUST produce a WalletLedger row in the same Prisma tx.
 *  - balanceInPaise on Wallet is a cached projection; WalletLedger is the source of truth.
 */

import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LedgerCategory =
  | 'TOP_UP'
  | 'SECURITY_DEPOSIT'
  | 'RENT_PAYMENT'
  | 'REWARD'
  | 'REFUND'
  | 'REVERSAL'
  | 'ADMIN_ADJUSTMENT'
  | 'FORFEITURE';

export type WalletEntryType = 'CREDIT' | 'DEBIT';

interface WalletMutationParams {
  riderId: string;
  walletId: string;
  amountInPaise: number; // always positive
  category: LedgerCategory;
  txnId?: string; // parent Transaction.id
  idempotencyKey?: string;
  actorId?: string; // admin ID if admin-triggered
  note?: string;
}

interface LedgerIntegrityResult {
  ok: boolean;
  walletBalance: number;
  ledgerSum: number;
  drift: number; // walletBalance - ledgerSum (0 = healthy)
}

// ---------------------------------------------------------------------------
// Core mutation helpers
// These accept a Prisma transaction client (tx) so callers can compose them.
// ---------------------------------------------------------------------------

/**
 * Credits the wallet (increases balanceInPaise) and appends a CREDIT ledger entry.
 * Must be called inside a Prisma $transaction block.
 */
export async function creditWallet(
  tx: any,
  params: WalletMutationParams
): Promise<{ newBalance: number; ledgerEntryId: string }> {
  const { riderId, walletId, amountInPaise, category, txnId, idempotencyKey, actorId, note } =
    params;

  if (amountInPaise <= 0) {
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
      txnId: txnId ?? null,
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

/**
 * Debits the wallet (decreases balanceInPaise) and appends a DEBIT ledger entry.
 * Throws if balance would go negative (use allowNegative: true for overdrafts like late fees).
 * Must be called inside a Prisma $transaction block.
 */
export async function debitWallet(
  tx: any,
  params: WalletMutationParams & { allowNegative?: boolean }
): Promise<{ newBalance: number; ledgerEntryId: string }> {
  const {
    riderId,
    walletId,
    amountInPaise,
    category,
    txnId,
    idempotencyKey,
    actorId,
    note,
    allowNegative = false,
  } = params;

  if (amountInPaise <= 0) {
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

  // Decrement wallet balance
  const updatedWallet = await tx.wallet.update({
    where: { id: walletId },
    data: {
      balanceInPaise: { decrement: amountInPaise },
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
      txnId: txnId ?? null,
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

/**
 * Credits the securityDeposit field (not the general balance) and writes a ledger entry.
 * Used when approving a SECURITY_DEPOSIT transaction.
 * Must be called inside a Prisma $transaction block.
 */
export async function creditSecurityDeposit(
  tx: any,
  params: {
    riderId: string;
    walletId: string;
    amountInPaise: number;
    txnId?: string;
    actorId?: string;
    note?: string;
  }
): Promise<void> {
  const { riderId, walletId, amountInPaise, txnId, actorId, note } = params;

  await tx.wallet.update({
    where: { id: walletId },
    data: {
      securityDeposit: { increment: amountInPaise },
      depositStatus: 'APPROVED',
      version: { increment: 1 },
    },
  });

  await tx.walletLedger.create({
    data: {
      walletId,
      riderId,
      txnId: txnId ?? null,
      entryType: 'CREDIT',
      category: 'SECURITY_DEPOSIT',
      amountInPaise,
      balanceAfter: 0, // deposit is tracked separately, not in balanceInPaise
      actorId: actorId ?? null,
      note: note ?? 'Security deposit approved',
    },
  });
}

/**
 * Debits the securityDeposit field and writes a ledger entry.
 * Used for REFUND or FORFEITURE of a security deposit.
 * Must be called inside a Prisma $transaction block.
 */
export async function debitSecurityDeposit(
  tx: any,
  params: {
    riderId: string;
    walletId: string;
    amountInPaise: number;
    category: 'REFUND' | 'FORFEITURE';
    newDepositStatus: 'REFUNDED' | 'FORFEITED';
    txnId?: string;
    actorId?: string;
    note?: string;
  }
): Promise<void> {
  const { riderId, walletId, amountInPaise, category, newDepositStatus, txnId, actorId, note } =
    params;

  await tx.wallet.update({
    where: { id: walletId },
    data: {
      securityDeposit: { decrement: amountInPaise },
      depositStatus: newDepositStatus,
      version: { increment: 1 },
    },
  });

  await tx.walletLedger.create({
    data: {
      walletId,
      riderId,
      txnId: txnId ?? null,
      entryType: 'DEBIT',
      category,
      amountInPaise,
      balanceAfter: 0,
      actorId: actorId ?? null,
      note: note ?? `Security deposit ${category.toLowerCase()}`,
    },
  });
}

/**
 * Creates a REVERSAL entry that offsets a prior approved transaction.
 * Does NOT reset the original transaction to PENDING — marks it REVERSED (terminal).
 * Must be called inside a Prisma $transaction block.
 */
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
      amount: originalAmount,
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

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Verifies ledger integrity for a single rider:
 * sums all CREDIT/DEBIT WalletLedger entries (excluding SECURITY_DEPOSIT which
 * tracks securityDeposit, not balanceInPaise) and compares to wallet.balanceInPaise.
 */
export async function verifyLedgerIntegrity(
  db: any,
  riderId: string
): Promise<LedgerIntegrityResult> {
  const wallet = await db.wallet.findUnique({
    where: { riderId },
    select: { balanceInPaise: true },
  });

  if (!wallet) {
    return { ok: false, walletBalance: 0, ledgerSum: 0, drift: 0 };
  }

  // Sum ledger entries that affect balanceInPaise (exclude SECURITY_DEPOSIT & FORFEITURE
  // because those change securityDeposit, not balanceInPaise)
  const ledgerEntries = await db.walletLedger.findMany({
    where: {
      riderId,
      category: { notIn: ['SECURITY_DEPOSIT', 'FORFEITURE', 'REFUND'] },
    },
    select: { entryType: true, amountInPaise: true },
  });

  const ledgerSum = ledgerEntries.reduce((sum: number, entry: any) => {
    return entry.entryType === 'CREDIT' ? sum + entry.amountInPaise : sum - entry.amountInPaise;
  }, 0);

  const drift = wallet.balanceInPaise - ledgerSum;

  return {
    ok: drift === 0,
    walletBalance: wallet.balanceInPaise,
    ledgerSum,
    drift,
  };
}

// ---------------------------------------------------------------------------
// Backfill helper — run once for existing wallets that predate the ledger
// ---------------------------------------------------------------------------

/**
 * Creates an opening-balance ADMIN_ADJUSTMENT ledger entry for a wallet that has
 * a non-zero balance but no existing ledger entries. Safe to call multiple times
 * (idempotency key prevents duplicates).
 */
export async function backfillOpeningBalance(db: any, riderId: string): Promise<void> {
  const wallet = await db.wallet.findUnique({
    where: { riderId },
    select: { id: true, balanceInPaise: true },
  });
  if (!wallet || wallet.balanceInPaise === 0) return;

  const idempotencyKey = `backfill:opening:${wallet.id}`;
  const existing = await db.walletLedger.findUnique({ where: { idempotencyKey } });
  if (existing) return; // already done

  await db.walletLedger.create({
    data: {
      walletId: wallet.id,
      riderId,
      entryType: 'CREDIT',
      category: 'ADMIN_ADJUSTMENT',
      amountInPaise: wallet.balanceInPaise,
      balanceAfter: wallet.balanceInPaise,
      idempotencyKey,
      note: 'Opening balance backfill — pre-ledger wallet balance',
    },
  });

  logger.info('[WalletService] backfillOpeningBalance', {
    riderId,
    amountInPaise: wallet.balanceInPaise,
  });
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class WalletServiceError extends Error {
  code: string;
  constructor(message: string, code: string = 'WALLET_ERROR') {
    super(message);
    this.name = 'WalletServiceError';
    this.code = code;
  }
}
