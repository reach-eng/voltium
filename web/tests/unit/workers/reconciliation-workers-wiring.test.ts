/**
 * P0-5 (financial audit) / audit #23 P0-1 — worker-wiring regression guard.
 *
 * The reconciliation logic was unified to a single SQL aggregation
 * (PR-148) and `reconciliation.job.ts` became a thin wrapper — but the
 * WORKERS array was never covered by a test. That gap hid two live bugs:
 *
 *   1. `admin.job.wallet_reconciliation` — the ONLY event type actually
 *      emitted today (POST /api/admin/jobs) — had no consumer entry, so
 *      admin-triggered reconciliation events piled up PENDING forever.
 *
 *   2. The wired `wallet.reconciliation` entry used an inline processor
 *      that never persisted the daily `reconciliationReport` row (the cron
 *      pre-check + admin Jobs reconHistory depended on it) and always
 *      recorded `actorId: 'system'` even for admin-triggered runs.
 *
 * This test asserts the source-level contract so the wiring can't silently
 * regress: BOTH event types must route to `reconciliationJob.process`, and
 * the unattributed inline processor must stay gone.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const WORKERS_INDEX = resolve(
  __dirname,
  '../../../src/server/workers/index.ts'
);

function src(): string {
  return readFileSync(WORKERS_INDEX, 'utf-8');
}

describe('Workers wiring — reconciliation (P0-5 / audit #23 P0-1)', () => {
  it('workers/index.ts exists', () => {
    expect(existsSync(WORKERS_INDEX)).toBe(true);
  });

  it('routes the system wallet.reconciliation event to reconciliationJob.process', () => {
    const s = src();
    // The WALLET_RECONCILIATION entry must use the shared processor — not an
    // inline run+record lambda.
    const systemEntry = s.match(
      /jobType:\s*OutboxEventTypes\.WALLET_RECONCILIATION[\s\S]{0,300}processor:\s*reconciliationJob\.process/
    );
    expect(systemEntry, 'WALLET_RECONCILIATION must use reconciliationJob.process').not.toBeNull();
  });

  it('routes the admin-triggered admin.job.wallet_reconciliation event to reconciliationJob.process', () => {
    const s = src();
    const adminEntry = s.match(
      /jobType:\s*OutboxEventTypes\.ADMIN_JOB_WALLET_RECONCILIATION[\s\S]{0,300}processor:\s*reconciliationJob\.process/
    );
    expect(
      adminEntry,
      'ADMIN_JOB_WALLET_RECONCILIATION (the live admin-trigger path) must have a consumer'
    ).not.toBeNull();
  });

  it('imports reconciliationJob from the thin wrapper', () => {
    const s = src();
    expect(s).toMatch(/import\s*\{\s*reconciliationJob\s*\}\s*from\s*'\.\/jobs\/reconciliation\.job'/);
  });

  it('no longer uses the unattributed inline processor (runWalletReconciliation + recordReconciliation without actor)', () => {
    const s = src();
    // The old inline form:
    //   processor: async () => {
    //     const res = await runWalletReconciliation();
    //     await recordReconciliation(res);
    expect(s).not.toMatch(
      /processor:\s*async\s*\(\)\s*=>\s*\{\s*[\s\S]*?runWalletReconciliation\(\)[\s\S]*?recordReconciliation\(res\)/
    );
    // And the direct imports of those two are gone — attribution now lives in
    // reconciliation.job.ts where the payload.triggeredBy is threaded.
    expect(s).not.toMatch(
      /import\s*\{\s*runWalletReconciliation,\s*recordReconciliation\s*\}\s*from\s*'\.\/jobs\/wallet-reconciliation\.job'/
    );
  });
});
