import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { backfillOpeningBalance } from '@/lib/services/wallet-service';
import { OutboxService, OutboxEventTypes } from '../outbox';

interface ReconciliationResult {
  reportDate: string;
  totalWallets: number;
  matched: number;
  mismatched: number;
  drift: number;
  healthy: boolean;
}

export const reconciliationJob = {
  async process(job: any): Promise<ReconciliationResult> {
    logger.info('[ReconciliationJob] Starting', { jobId: job.id });

    const today = new Date().toISOString().split('T')[0];

    // Idempotent check
    const existingReport = await db.reconciliationReport.findUnique({
      where: { reportDate: today },
    });
    if (existingReport) {
      logger.info('[ReconciliationJob] Already ran today', { date: today });
      return {
        reportDate: today,
        totalWallets: existingReport.totalWallets,
        matched: existingReport.matched,
        mismatched: existingReport.mismatched,
        drift: existingReport.drift,
        healthy: existingReport.mismatched === 0,
      };
    }

    // 1. Backfill opening balances
    const allRiderIds = await db.wallet.findMany({ select: { riderId: true } });
    for (const { riderId } of allRiderIds) {
      await backfillOpeningBalance(db, riderId).catch((err: Error) => {
        logger.error('[ReconciliationJob] backfill error', { riderId, err });
      });
    }

    // 2. Compare ledger sums to wallet balances
    const wallets = await db.wallet.findMany({
      select: { id: true, riderId: true, balanceInPaise: true },
    });

    let matched = 0;
    let mismatched = 0;
    let totalLedgerSum = 0;
    let totalWalletSum = 0;
    const mismatchDetails: Array<{
      riderId: string;
      ledgerSum: number;
      walletBalance: number;
      drift: number;
    }> = [];

    for (const wallet of wallets) {
      const entries = await db.walletLedger.findMany({
        where: {
          walletId: wallet.id,
          category: { notIn: ['SECURITY_DEPOSIT', 'FORFEITURE', 'REFUND'] },
        },
        select: { entryType: true, amountInPaise: true },
      });

      const ledgerSum = entries.reduce((sum: number, e: any) => {
        return e.entryType === 'CREDIT' ? sum + e.amountInPaise : sum - e.amountInPaise;
      }, 0);

      const drift = wallet.balanceInPaise - ledgerSum;
      totalLedgerSum += ledgerSum;
      totalWalletSum += wallet.balanceInPaise;

      if (drift === 0) {
        matched++;
      } else {
        mismatched++;
        mismatchDetails.push({
          riderId: wallet.riderId,
          ledgerSum,
          walletBalance: wallet.balanceInPaise,
          drift,
        });
      }
    }

    // 3. Store report
    const report = await db.reconciliationReport.create({
      data: {
        reportDate: today,
        totalWallets: wallets.length,
        matched,
        mismatched,
        totalLedgerSum,
        totalWalletSum,
        drift: totalWalletSum - totalLedgerSum,
        mismatchDetails: JSON.stringify(mismatchDetails),
      },
    });

    // 4. Alert on mismatches
    if (mismatched > 0) {
      logger.error('[ReconciliationJob] MISMATCH ALERT', {
        date: today,
        mismatched,
        totalDrift: totalWalletSum - totalLedgerSum,
      });

      // Emit outbox event for alerting
      await OutboxService.emit(OutboxEventTypes.ADMIN_ACTION, {
        action: 'reconciliation.mismatch_alert',
        reportDate: today,
        mismatched,
        totalDrift: totalWalletSum - totalLedgerSum,
      }).catch(() => {});
    }

    logger.info('[ReconciliationJob] Complete', {
      date: today,
      totalWallets: wallets.length,
      matched,
      mismatched,
      drift: totalWalletSum - totalLedgerSum,
    });

    return {
      reportDate: today,
      totalWallets: wallets.length,
      matched,
      mismatched,
      drift: totalWalletSum - totalLedgerSum,
      healthy: mismatched === 0,
    };
  },
};
