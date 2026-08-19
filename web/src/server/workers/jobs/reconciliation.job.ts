import { db } from '@/lib/db';
import { type QueueJob } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import { OutboxService, OutboxEventTypes } from '../outbox';
import {
  runWalletReconciliation,
  recordReconciliation,
  persistReconciliationReport,
} from './wallet-reconciliation.job';

interface ReconciliationResult {
  reportDate: string;
  totalWallets: number;
  matched: number;
  mismatched: number;
  drift: number;
  healthy: boolean;
}

/**
 * Reconciliation job (outbox worker for WALLET_RECONCILIATION and
 * ADMIN_JOB_WALLET_RECONCILIATION events — one fast path for both triggers).
 *
 * P0-5 (financial audit): this file previously reimplemented the whole
 * reconciliation in N+1 style — one `walletLedger.findMany` per wallet
 * (100k queries for a 100k-wallet install) — and drifted from the
 * single-SQL implementation in wallet-reconciliation.job.ts. It is now a
 * thin wrapper: the computation is delegated to `runWalletReconciliation`
 * (PR-148 single aggregation), the daily `reconciliationReport` row is
 * persisted via the shared `persistReconciliationReport`, the audit trail
 * records the triggering admin (P0-4), and the mismatch alert is emitted.
 *
 * WIRING (2026-08-06): WORKERS in workers/index.ts routes BOTH
 * `wallet.reconciliation` and `admin.job.wallet_reconciliation` here. The
 * admin-jobs route (`POST /api/admin/jobs`) is the only live emitter
 * today (it passes `triggeredBy` in the payload); the wallet event has no
 * emitters yet but shares the same processor so the two can never drift.
 *
 * Stated decision (P0-5): the old worker's per-wallet `backfillOpeningBalance`
 * step is intentionally dropped. It auto-healed pre-ledger wallets to zero
 * drift, masking real drift; the canonical single-SQL path reports such
 * wallets as drifted (the cron route already did this). If legacy wallets
 * exist, run a one-time backfill before relying on drift alerts.
 */
export const reconciliationJob = {
  async process(job: QueueJob): Promise<ReconciliationResult> {
    logger.info('[ReconciliationJob] Starting', { jobId: job.id });

    // DD-MM-YYYY — the SAME format the cron route's pre-check queries
    // (formatDateDDMMYYYY), so the report row written here is visible to
    // the daily no-op check and the admin Background Jobs screen.
    const today = formatDateDDMMYYYY(clock.now());

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

    // P0-5: delegate the computation to the canonical single-SQL job.
    const rec = await runWalletReconciliation();

    // 3. Store report (shared helper — also used by the cron route, so both
    // paths produce the same row and the P2002 race resolves the same way).
    await persistReconciliationReport(rec, today);

    // P0-4: attribute admin-triggered runs. The admin-jobs route puts
    // `triggeredBy` in the outbox payload; cron/system runs default to
    // 'system'. The audit row is what the SOC2 trail shows for a run.
    const actorId: string | undefined = job?.payload?.triggeredBy as string | undefined;
    await recordReconciliation(rec, {
      actorId,
      actorType: actorId ? 'ADMIN' : 'SYSTEM',
    });

    // 4. Alert on mismatches
    if (rec.drifted > 0) {
      logger.error('[ReconciliationJob] MISMATCH ALERT', {
        date: today,
        mismatched: rec.drifted,
        totalDrift: rec.totalDrift,
      });

      // Emit outbox event for alerting.
      // P3-10 (financial audit): the mismatch alert is SOC2-critical — the
      // old `.catch(() => {})` swallowed emit failures entirely. Log loudly
      // so ops can re-trigger the alert.
      await OutboxService.emit(OutboxEventTypes.ADMIN_ACTION, {
        action: 'reconciliation.mismatch_alert',
        reportDate: today,
        mismatched: rec.drifted,
        totalDrift: rec.totalDrift,
      }).catch((err) => {
        logger.error('[ReconciliationJob] Failed to emit mismatch alert', {
          error: err instanceof Error ? err.message : String(err),
          reportDate: today,
          mismatched: rec.drifted,
        });
      });
    }

    logger.info('[ReconciliationJob] Complete', {
      date: today,
      totalWallets: rec.totalWallets,
      matched: rec.healthy,
      mismatched: rec.drifted,
      drift: rec.totalDrift,
    });

    return {
      reportDate: today,
      totalWallets: rec.totalWallets,
      matched: rec.healthy,
      mismatched: rec.drifted,
      drift: rec.totalDrift,
      healthy: rec.drifted === 0,
    };
  },
};
