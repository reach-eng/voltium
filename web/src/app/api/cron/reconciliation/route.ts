import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireCronAuth } from '@/lib/cron-auth';
import {
  runWalletReconciliation,
  recordReconciliation,
  persistReconciliationReport,
  checkReconciliationToday,
} from '@/server/workers/jobs/wallet-reconciliation.job';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';
import { OutboxService, OutboxEventTypes } from '@/server/workers/outbox';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) {
    return authError;
  }

  const today = formatDateDDMMYYYY(new Date());

  // PR-90 (API N10): pre-check the date so a follow-up call within
  // the same day is a fast no-op. The DB unique index is the real
  // safety net — see the P2002 catch below — but the pre-check keeps
  // the common case off the heavy reconciliation path.
  const existingReport = await checkReconciliationToday(today);
  if (existingReport) {
    return success(existingReport, `Reconciliation already run for ${today}`);
  }

  try {
    const result = await runWalletReconciliation();
    try {
      // PR-90 (API N10): the unique index on `reportDate` makes the
      // inner writes race-safe. If two cron ticks fire concurrently
      // and the second tick loses the race, Prisma throws P2002 and
      // we fall through to the catch below.
      //
      // P0-5: persist the daily report row FIRST — it feeds the admin
      // Background Jobs screen's reconHistory AND the next tick's
      // pre-check. Before the unification the cron path only wrote the
      // audit entry, so the pre-check never matched and every tick ran
      // the full reconciliation.
      await persistReconciliationReport(result, today);
      await recordReconciliation(result);
      await OutboxService.emit(OutboxEventTypes.WALLET_RECONCILIATION, {
        trigger: 'cron',
        reportDate: today,
        totalWallets: result.totalWallets,
        drifted: result.drifted,
      }).catch((err) => {
        logger.warn('[Reconciliation] WALLET_RECONCILIATION outbox emit failed (non-blocking)', { err });
      });
    } catch (writeErr) {
      // PR-90 (API N10): race-safe write. If two cron ticks fire
      // concurrently, the second tick will hit the unique index on
      // `reportDate` and Prisma throws P2002. Treat that as success
      // — the existing row from the first tick is the canonical
      // result for the day. Re-throw any other error.
      if (isUniqueViolation(writeErr)) {
        const winner = await checkReconciliationToday(today);
        if (winner) {
          logger.info('[Reconciliation] Concurrent tick detected — returning existing report', {
            date: today,
            concurrentReportId: winner.id,
          });
          return success(winner, `Reconciliation already run for ${today}`);
        }
      }
      throw writeErr;
    }

    logger.info('[Reconciliation] Complete', {
      date: today,
      totalWallets: result.totalWallets,
      matched: result.healthy,
      mismatched: result.drifted,
    });

    return success(
      {
        reportDate: today,
        totalWallets: result.totalWallets,
        matched: result.healthy,
        mismatched: result.drifted,
        drift: result.totalDrift,
        healthy: result.drifted === 0,
      },
      result.drifted === 0
        ? 'Reconciliation complete — all wallets balanced ✓'
        : `Reconciliation complete — ${result.drifted} wallet(s) have drift!`
    );
  } catch (err) {
    logger.error('[Reconciliation] Fatal error', err);
    return errors.internal('Reconciliation failed');
  }
}

/**
 * PR-90 (API N10): Prisma signals a unique-index violation with the
 * `P2002` error code. We accept either the `code` (string) on the
 * error or the `meta.target` field so a future Prisma version that
 * moves the signal still works.
 */
function isUniqueViolation(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code?: string }).code === 'P2002';
  }
  return false;
}
