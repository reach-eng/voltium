/**
 * Wallet Reconciliation Job
 *
 * Compares each wallet's balanceInPaise against the sum of its WalletLedger entries.
 * Drift should be 0 for all wallets if the system is operating correctly.
 *
 * Run on a schedule (e.g., daily cron) or trigger manually from admin.
 * If drift is detected, the job logs the discrepancy for manual review.
 *
 * PR-148 (AUDIT_WORKERS §4.5) — replaced the N+1 (one query per wallet)
 * implementation with a single SQL aggregation via Prisma's $queryRaw.
 * The previous version ran 100k+ queries for a 100k-wallet install; the
 * new version runs ONE query and is O(1) round-trips regardless of
 * wallet count. The N+1 was the same `verifyLedgerIntegrity` helper
 * still available for ad-hoc per-wallet checks; the bulk path now
 * uses a `SUM(CASE WHEN ...)` aggregate grouped by rider.
 *
 * Usage:
 *   import { runWalletReconciliation } from '@/server/workers/jobs/wallet-reconciliation.job';
 *   const results = await runWalletReconciliation();
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { alerter } from '@/lib/alerter';
import { createAuditLog } from '@/lib/audit-log';
import { logReconciliationMismatch } from '@/lib/security-events';

export async function checkReconciliationToday(today: string) {
  return db.reconciliationReport.findUnique({ where: { reportDate: today } });
}

export interface ReconciliationResult {
  totalWallets: number;
  healthy: number;
  drifted: number;
  totalDrift: number;
  /** Sum of every wallet's balanceInPaise (healthy + drifted). */
  totalWalletSum: number;
  /** Sum of every wallet's ledger total (healthy + drifted). */
  totalLedgerSum: number;
  driftedRiders: Array<{
    riderId: string;
    drift: number;
    walletBalance: number;
    ledgerSum: number;
  }>;
}

interface WalletDriftRow {
  riderId: string;
  walletBalance: number;
  ledgerSum: number;
  drift: number;
}

/**
 * PR-148: One SQL query that returns every wallet + its ledger sum +
 * drift. Replaces the N+1 per-wallet `verifyLedgerIntegrity` loop.
 *
 * The query groups `WalletLedger` by `riderId` and applies the
 * sign convention (CREDIT = +, DEBIT = -) via `SUM(CASE WHEN entryType
 * = 'CREDIT' THEN amountInPaise ELSE -amountInPaise END)`. The
 * categories that don't affect `balanceInPaise` (SECURITY_DEPOSIT,
 * FORFEITURE, REFUND) are excluded via the `WHERE` clause.
 *
 * P1-19 (financial audit): the exclusion was flagged as possibly wrong —
 * "a REFUND credits the wallet". Verified against wallet-service: deposit
 * entries (SECURITY_DEPOSIT/FORFEITURE/REFUND) write `balanceAfter: 0` and
 * never mutate `balanceInPaise`, so excluding them is CORRECT — a refund or
 * forfeiture history cannot produce phantom drift.
 *
 * `LEFT JOIN` ensures wallets with zero ledger rows are still
 * included (their `ledgerSum` is 0 and `drift` equals
 * `walletBalance`, which is the correct drift).
 */
async function fetchAllWalletDrifts(): Promise<WalletDriftRow[]> {
  // We use $queryRaw here because Prisma doesn't support
  // SUM(CASE WHEN...) in `groupBy` and the alternative is dozens
  // of raw rows for typed `groupBy` + manual sum. The query is
  // parameterless (no user input), so $queryRaw is safe.
  const rows = await db.$queryRaw<WalletDriftRow[]>`
    SELECT
      w."riderId"          AS "riderId",
      w."balanceInPaise"   AS "walletBalance",
      COALESCE(SUM(
        CASE
          WHEN wl."entryType" = 'CREDIT' THEN wl."amountInPaise"
          ELSE -wl."amountInPaise"
        END
      ), 0)::bigint::int   AS "ledgerSum",
      (w."balanceInPaise" - COALESCE(SUM(
        CASE
          WHEN wl."entryType" = 'CREDIT' THEN wl."amountInPaise"
          ELSE -wl."amountInPaise"
        END
      ), 0))::bigint::int AS "drift"
    FROM "wallets" w
    LEFT JOIN "wallet_ledgers" wl
      ON wl."riderId" = w."riderId"
      AND wl."category" NOT IN ('SECURITY_DEPOSIT', 'FORFEITURE', 'REFUND')
    GROUP BY w."riderId", w."balanceInPaise"
  `;
  return rows;
}

export async function runWalletReconciliation(): Promise<ReconciliationResult> {
  logger.info('[Reconciliation] Starting wallet reconciliation...');

  // PR-148: single SQL query replaces the N+1 per-wallet loop.
  // 100k wallets → 1 query instead of 100k.
  const rows = await fetchAllWalletDrifts();

  const result: ReconciliationResult = {
    totalWallets: rows.length,
    healthy: 0,
    drifted: 0,
    totalDrift: 0,
    totalWalletSum: 0,
    totalLedgerSum: 0,
    driftedRiders: [],
  };

  for (const row of rows) {
    result.totalWalletSum += row.walletBalance;
    result.totalLedgerSum += row.ledgerSum;
    if (row.drift === 0) {
      result.healthy++;
      continue;
    }
    result.drifted++;
    result.totalDrift += row.drift;
    result.driftedRiders.push({
      riderId: row.riderId,
      drift: row.drift,
      walletBalance: row.walletBalance,
      ledgerSum: row.ledgerSum,
    });

    logger.warn('[Reconciliation] Drift detected', {
      riderId: row.riderId,
      drift: row.drift,
      walletBalance: row.walletBalance,
      ledgerSum: row.ledgerSum,
    });

    // PR-99: fire security-event logger so the drift is recorded in the
    // audit log (SOC2 requirement). Fire-and-forget so the job loop is
    // not slowed by audit-log writes.
    void logReconciliationMismatch({
      riderId: row.riderId,
      ledgerSum: row.ledgerSum,
      walletBalance: row.walletBalance,
      drift: row.drift,
    });
  }

  logger.info('[Reconciliation] Complete', {
    totalWallets: result.totalWallets,
    healthy: result.healthy,
    drifted: result.drifted,
    totalDrift: result.totalDrift,
  });

  if (result.drifted > 0) {
    // P3-10 (financial audit): the drift alert is the SOC2-critical signal.
    // alerter.send always logs locally even when the webhook is down, but the
    // old fire-and-forget call meant a throw escaped the job silently. Await +
    // guard it so a delivery failure is loud and can never be dropped.
    try {
      await alerter.send({
        level: 'error',
        title: 'Wallet drift detected',
        message: `Found ${result.drifted} drifted wallets with total drift ${result.totalDrift} paise`,
        details: { count: result.drifted, totalDrift: result.totalDrift },
      });
    } catch (err) {
      logger.error('[Reconciliation] Drift alert failed to send', {
        error: err instanceof Error ? err.message : String(err),
        drifted: result.drifted,
        totalDrift: result.totalDrift,
      });
    }
  }

  return result;
}

/**
 * Number of drifted-rider samples persisted in the audit record.
 * P0-8 (financial audit): the old `details: result as any` serialized ALL
 * driftedRiders into the audit entry. A 10k-wallet drift blew past the
 * outbox 64KB payload cap, the write was swallowed, and the ONLY record of
 * the drift was lost. We now persist a capped sample plus a `truncated` flag
 * and the real count.
 */
export const DRIFT_RIDER_SAMPLE_CAP = 100;

/**
 * Persist the daily `reconciliationReport` row (P0-5 unification).
 *
 * Both the outbox worker AND the cron route write this row — it is what
 * `/api/cron/reconciliation`'s pre-check reads and what the admin Background
 * Jobs screen's `reconHistory` displays. Before the unification, the wired
 * worker ran the single-SQL job but never created the row, so the pre-check
 * was dead and reconHistory was always empty.
 *
 * `reportDate` is passed by the caller (both callers use the canonical
 * DD-MM-YYYY format) so the pre-check key and the stored key can never
 * diverge.
 *
 * A P2002 (unique index on reportDate) means another tick already won the
 * race today — that's success, not an error (matches the cron route's
 * race-safety design).
 */
export async function persistReconciliationReport(
  result: ReconciliationResult,
  reportDate: string
): Promise<void> {
  try {
    await db.reconciliationReport.create({
      data: {
        reportDate,
        totalWallets: result.totalWallets,
        matched: result.healthy,
        mismatched: result.drifted,
        totalLedgerSum: result.totalLedgerSum,
        totalWalletSum: result.totalWalletSum,
        drift: result.totalDrift,
        mismatchDetails: JSON.stringify(result.driftedRiders),
      },
    });
  } catch (err: unknown) {
    if (err && typeof err === 'object' && (err as { code?: string }).code === 'P2002') {
      // Another tick wrote today's report — the winner's row is canonical.
      return;
    }
    throw err;
  }
}

export async function recordReconciliation(
  result: ReconciliationResult,
  options?: { actorId?: string; actorType?: 'ADMIN' | 'SYSTEM' }
): Promise<void> {
  try {
    // P0-4 (financial audit): the admin route now passes the acting admin's
    // id so the run is attributable; cron/system runs default to 'system'.
    const actorId = options?.actorId ?? 'system';
    const driftedRiders = result.driftedRiders.slice(0, DRIFT_RIDER_SAMPLE_CAP);

    await createAuditLog({
      actorId,
      actorType: options?.actorType ?? 'SYSTEM',
      action: 'reconciliation.run',
      entity: 'wallet',
      entityId: 'all',
      details: {
        totalWallets: result.totalWallets,
        healthy: result.healthy,
        drifted: result.drifted,
        totalDrift: result.totalDrift,
        driftedRiderCount: result.driftedRiders.length,
        driftedRiders,
        truncated: result.driftedRiders.length > DRIFT_RIDER_SAMPLE_CAP,
      },
    });
    logger.info('[Reconciliation] Report recorded in audit log', {
      actorId,
      driftedRiderCount: result.driftedRiders.length,
      truncated: result.driftedRiders.length > DRIFT_RIDER_SAMPLE_CAP,
    });
  } catch (err) {
    logger.error('[Reconciliation] Failed to record report', err);
  }
}
