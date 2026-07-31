import { logger } from '@/lib/logger';

export interface LedgerIntegrityResult {
  ok: boolean;
  walletBalance: number;
  ledgerSum: number;
  drift: number; // walletBalance - ledgerSum (0 = healthy)
}

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
