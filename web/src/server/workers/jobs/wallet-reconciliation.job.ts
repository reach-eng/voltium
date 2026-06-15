/**
 * Wallet Reconciliation Job
 *
 * Compares each wallet's balanceInPaise against the sum of its WalletLedger entries.
 * Drift should be 0 for all wallets if the system is operating correctly.
 *
 * Run on a schedule (e.g., daily cron) or trigger manually from admin.
 * If drift is detected, the job logs the discrepancy for manual review.
 *
 * Usage:
 *   import { runWalletReconciliation } from '@/server/workers/jobs/wallet-reconciliation.job';
 *   const results = await runWalletReconciliation();
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { verifyLedgerIntegrity } from '@/lib/services/wallet-service';
import { createAuditLog } from '@/lib/audit-log';

export async function checkReconciliationToday(today: string) {
  return db.reconciliationReport.findUnique({ where: { reportDate: today } });
}

export interface ReconciliationResult {
  totalWallets: number;
  healthy: number;
  drifted: number;
  totalDrift: number;
  driftedRiders: Array<{ riderId: string; drift: number; walletBalance: number; ledgerSum: number }>;
}

export async function runWalletReconciliation(): Promise<ReconciliationResult> {
  logger.info('[Reconciliation] Starting wallet reconciliation...');

  const wallets = await db.wallet.findMany({
    select: { riderId: true },
  });

  const result: ReconciliationResult = {
    totalWallets: wallets.length,
    healthy: 0,
    drifted: 0,
    totalDrift: 0,
    driftedRiders: [],
  };

  for (const wallet of wallets) {
    const integrity = await verifyLedgerIntegrity(db, wallet.riderId);

    if (integrity.drift === 0) {
      result.healthy++;
    } else {
      result.drifted++;
      result.totalDrift += integrity.drift;
      result.driftedRiders.push({
        riderId: wallet.riderId,
        drift: integrity.drift,
        walletBalance: integrity.walletBalance,
        ledgerSum: integrity.ledgerSum,
      });

      logger.warn('[Reconciliation] Drift detected', {
        riderId: wallet.riderId,
        drift: integrity.drift,
        walletBalance: integrity.walletBalance,
        ledgerSum: integrity.ledgerSum,
      });
    }
  }

  logger.info('[Reconciliation] Complete', {
    totalWallets: result.totalWallets,
    healthy: result.healthy,
    drifted: result.drifted,
    totalDrift: result.totalDrift,
  });

  return result;
}

export async function recordReconciliation(result: ReconciliationResult): Promise<void> {
  try {
    await createAuditLog({
      actorId: 'system',
      actorType: 'SYSTEM',
      action: 'reconciliation.run',
      entity: 'wallet',
      entityId: 'all',
      details: result as any,
    });
    logger.info('[Reconciliation] Report recorded in audit log');
  } catch (err) {
    logger.error('[Reconciliation] Failed to record report', err);
  }
}
