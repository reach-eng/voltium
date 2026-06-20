import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireCronAuth } from '@/lib/cron-auth';
import { runWalletReconciliation, recordReconciliation, checkReconciliationToday } from '@/server/workers/jobs/wallet-reconciliation.job';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) {
    return authError;
  }

  const today = new Date().toISOString().split('T')[0];

  const existingReport = await checkReconciliationToday(today);
  if (existingReport) {
    return success(existingReport, `Reconciliation already run for ${today}`);
  }

  try {
    const result = await runWalletReconciliation();
    await recordReconciliation(result);

    logger.info('[Reconciliation] Complete', { date: today, totalWallets: result.totalWallets, matched: result.healthy, mismatched: result.drifted });

    return success(
      { reportDate: today, totalWallets: result.totalWallets, matched: result.healthy, mismatched: result.drifted, drift: result.totalDrift, healthy: result.drifted === 0 },
      result.drifted === 0 ? 'Reconciliation complete — all wallets balanced ✓' : `Reconciliation complete — ${result.drifted} wallet(s) have drift!`
    );
  } catch (err) {
    logger.error('[Reconciliation] Fatal error', err);
    return errors.internal('Reconciliation failed');
  }
}
