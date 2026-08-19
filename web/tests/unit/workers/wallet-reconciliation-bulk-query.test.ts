/**
 * PR-148 (AUDIT_WORKERS §4.5) — Regression guard for the wallet-reconciliation
 * N+1 fix.
 *
 * The previous implementation called `verifyLedgerIntegrity(db, riderId)`
 * inside a `for (const wallet of wallets)` loop — 100k wallets = 200k+ DB
 * round-trips. The new implementation (commit e...) uses a single
 * `db.$queryRaw` aggregation that returns every wallet + its ledger sum
 * + drift in ONE query.
 *
 * This test asserts the source contains the bulk-aggregation pattern and
 * does NOT contain the per-wallet loop pattern. If a future refactor
 * regresses to the N+1 version, the test fails immediately.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const JOB = resolve(
  __dirname,
  '../../../src/server/workers/jobs/wallet-reconciliation.job.ts'
);

function src(): string {
  return readFileSync(JOB, 'utf-8');
}

describe('PR-148: wallet-reconciliation uses a single SQL aggregation', () => {
  it('job file exists', () => {
    expect(existsSync(JOB)).toBe(true);
  });

  it('declares fetchAllWalletDrifts helper that returns a typed row array', () => {
    const s = src();
    expect(s).toMatch(/async function fetchAllWalletDrifts\(\)/);
    // The function must return an array of typed rows.
    expect(s).toMatch(/fetchAllWalletDrifts\(\):\s*Promise<WalletDriftRow\[\]>/);
  });

  it('helper runs ONE $queryRaw aggregation (no per-wallet loop inside the SQL)', () => {
    const s = src();
    // The bulk query must use $queryRaw with a SUM(CASE WHEN...) aggregate.
    expect(s).toMatch(/\$queryRaw<WalletDriftRow\[\]>/);
    expect(s).toMatch(/SUM\(\s*\n?\s*CASE\s+WHEN/);
    // Groups by riderId + balanceInPaise.
    expect(s).toMatch(/GROUP BY\s+w\."riderId"/);
  });

  it('helper uses LEFT JOIN to include wallets with zero ledger rows', () => {
    const s = src();
    expect(s).toMatch(/LEFT JOIN\s+"wallet_ledgers"/);
    // The COALESCE on the SUM handles the 0-row case.
    expect(s).toMatch(/COALESCE\(SUM/);
  });

  it('helper excludes non-balanceInPaise categories (SECURITY_DEPOSIT, FORFEITURE, REFUND)', () => {
    const s = src();
    expect(s).toMatch(/NOT IN \('SECURITY_DEPOSIT',\s*'FORFEITURE',\s*'REFUND'\)/);
  });

  it('main reconciliation loop iterates over the bulk query result, not per-wallet DB calls', () => {
    const s = src();
    // The loop reads from `rows` (the aggregate result) and must NOT
    // call verifyLedgerIntegrity or any per-wallet DB function.
    const loopStart = s.indexOf('for (const row of rows)');
    expect(loopStart, 'expected loop over bulk rows').toBeGreaterThan(0);
    const loopBody = s.slice(loopStart, loopStart + 1500);
    expect(loopBody).not.toContain('verifyLedgerIntegrity');
    expect(loopBody).not.toContain('db.wallet.findUnique');
    expect(loopBody).not.toContain('db.walletLedger.findMany');
  });

  it('does NOT use the N+1 anti-pattern (for-of with await verifyLedgerIntegrity inside)', () => {
    const s = src();
    // Sanity: the old N+1 form `for (const wallet of wallets) { await verifyLedgerIntegrity(...) }`
    // must not be present.
    expect(s).not.toMatch(/for\s*\(\s*const\s+wallet\s+of\s+wallets\s*\)\s*\{[\s\S]*?await\s+verifyLedgerIntegrity/);
  });
});
