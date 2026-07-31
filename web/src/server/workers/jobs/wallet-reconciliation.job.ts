/**
 * Wallet Reconciliation Job
 *
 * Compares each wallet's balanceInPaise against the sum of its WalletLedger entries.
 * Drift should be 0 for all wallets if the system is operating correctly.
 *
 * Processes wallets in concurrent batches (default: 10) for O(N/concurrency) time.
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
import { alerter } from '@/lib/alerter';
import { verifyLedgerIntegrity } from '@/server/modules/wallet/wallet.queries';
import { createAuditLog } from '@/lib/audit-log';

const BATCH_SIZE = 10;

export async function checkReconciliationToday(today: string) {
  return db.reconciliationReport.findUnique({ where: { reportDate: today } });
}

export interface ReconciliationResult {
  totalWallets: number;
  healthy: number;
  drifted: number;
  totalDrift: number;
  driftedRiders: Array<{
    riderId: string;
    drift: number;
    walletBalance: number;
    ledgerSum: number;
  }>;
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

  // Process wallets in concurrent batches for O(N/BATCH_SIZE) time
  for (let i = 0; i < wallets.length; i += BATCH_SIZE) {
    const batch = wallets.slice(i, i + BATCH_SIZE);
    const outcomes = await Promise.allSettled(
      batch.map(async (wallet: { riderId: string }) => {
        const integrity = await verifyLedgerIntegrity(db, wallet.riderId);
        return { riderId: wallet.riderId, ...integrity };
      }),
    );

    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') {
        logger.error('[Reconciliation] Batch verification failed', {
          error: outcome.reason,
        });
        continue;
      }

      const integrity = outcome.value;
      if (integrity.drift === 0) {
        result.healthy++;
      } else {
        result.drifted++;
        result.totalDrift += integrity.drift;
        result.driftedRiders.push({
          riderId: integrity.riderId,
          drift: integrity.drift,
          walletBalance: integrity.walletBalance,
          ledgerSum: integrity.ledgerSum,
        });

        logger.warn('[Reconciliation] Drift detected', {
          riderId: integrity.riderId,
          drift: integrity.drift,
          walletBalance: integrity.walletBalance,
          ledgerSum: integrity.ledgerSum,
        });
      }
    }
  }

  logger.info('[Reconciliation] Complete', {
    totalWallets: result.totalWallets,
    healthy: result.healthy,
    drifted: result.drifted,
    totalDrift: result.totalDrift,
  });

  // Alert if any drift was detected
  if (result.drifted > 0) {
    await alerter.send({
      level: 'warn',
      title: 'Wallet reconciliation drift detected',
      source: 'wallet-reconciliation',
      message: `Reconciliation found ${result.drifted} wallet(s) with drift (total: ${result.totalDrift} paise)`,
      details: {
        totalWallets: result.totalWallets,
        healthy: result.healthy,
        drifted: result.drifted,
        totalDrift: result.totalDrift,
        topDrifts: result.driftedRiders.slice(0, 5),
      },
    });
  }

  return result;
}

export async function recordReconciliation(
  result: ReconciliationResult,
): Promise<void> {
  try {
    await createAuditLog({
      actorId: 'system',
      actorType: 'SYSTEM',
      action: 'reconciliation.run',
      entity: 'wallet',
      entityId: 'all',
      details: result as unknown as Record<string, unknown>,
    });
    logger.info('[Reconciliation] Report recorded in audit log');
  } catch (err) {
    logger.error('[Reconciliation] Failed to record report', err);
  }
}
