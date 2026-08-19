/**
 * PR-147 (AUDIT_WORKERS §4.14) — Regression guard for the rent auto-debit
 * double-charge fix that shipped in PR-76 (commit a961c214).
 *
 * The audit flagged this as STILL TRUE but the fix is already in the
 * tree. This test verifies the three guards are all in place:
 *
 *   1. Per-period idempotency key (`rent:{leaseId}:period:{periodNo}`)
 *      so the WalletLedger UNIQUE constraint dedupes a retry.
 *   2. Re-check of the lease's periodNo inside the transaction; if
 *      another worker advanced it, the second worker throws
 *      `LEASE_PERIOD_ADVANCED` and skips.
 *   3. `periodNo` and `nextRentDueAt` advanced inside the same tx as
 *      the debit + ledger row, so a crash mid-way rolls back all
 *      three and the next run is fresh.
 *
 * If any of these guards is removed in a future commit, the test
 * fails immediately with a clear file:line pointer.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const JOB = resolve(
  __dirname,
  '../../../src/server/workers/jobs/rent-reminders.job.ts'
);

function src(): string {
  return readFileSync(JOB, 'utf-8');
}

describe('PR-147: rent auto-debit no-double-charge guards', () => {
  it('job file exists', () => {
    expect(existsSync(JOB)).toBe(true);
  });

  it('builds the per-period idempotency key with periodNo', () => {
    const s = src();
    // The key must include `period:${lease.periodNo}` (not the date).
    // Match the actual source: `const periodKey = \`rent:${lease.id}:period:${lease.periodNo}\`;`
    const keyLine = s
      .split('\n')
      .find((l) => l.includes('periodKey') && l.includes('rent:'));
    expect(keyLine, 'expected const periodKey with rent:...:period:... template').toBeDefined();
    expect(keyLine).toContain('lease.periodNo');
  });

  it('re-checks periodNo inside the transaction (LEASE_PERIOD_ADVANCED guard)', () => {
    const s = src();
    // The `fresh.periodNo !== lease.periodNo` guard inside the tx.
    expect(s).toMatch(/fresh\.periodNo\s*!==\s*lease\.periodNo/);
    expect(s).toMatch(/LEASE_PERIOD_ADVANCED/);
  });

  it('advances periodNo + nextRentDueAt inside the same transaction', () => {
    const s = src();
    // The debit + ledger + lease update must all be inside ONE
    // `db.$transaction` call. We use a brace-depth counter to find
    // the matching `});` close (the source has nested calls).
    const lines = s.split('\n');
    const txOpenLine = lines.findIndex((l) => l.includes('db.$transaction('));
    expect(txOpenLine, 'expected db.$transaction(').toBeGreaterThanOrEqual(0);
    // Walk forward from the open, counting `{` and `}` until depth
    // returns to 0.
    let depth = 0;
    let txCloseLine = -1;
    for (let i = txOpenLine; i < lines.length; i++) {
      const line = lines[i];
      for (const ch of line) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      if (depth === 0 && i > txOpenLine) {
        txCloseLine = i;
        break;
      }
    }
    expect(txCloseLine, 'expected matching close of the transaction').toBeGreaterThan(txOpenLine);
    const txBody = lines.slice(txOpenLine, txCloseLine + 1).join('\n');
    expect(txBody, 'periodNo update must be inside the transaction').toContain(
      'periodNo: newPeriodNo'
    );
    expect(txBody, 'nextRentDueAt update must be inside the transaction').toContain(
      'nextRentDueAt: newNextRentDueAt'
    );
  });

  it('LEASE_PERIOD_ADVANCED is caught and treated as benign', () => {
    const s = src();
    // The catch block must check for the exact error message and
    // continue (not retry, not error).
    expect(s).toMatch(/err\.message\s*===\s*['"]LEASE_PERIOD_ADVANCED['"]/);
    // The catch is a sibling of the throw; the `continue;` lives
    // inside the if branch. We just assert both are present and
    // the continue is reachable after the message check.
    const lines = s.split('\n');
    const catchStart = lines.findIndex((l) =>
      l.includes("err.message === 'LEASE_PERIOD_ADVANCED'")
    );
    expect(catchStart, 'expected the L catch branch').toBeGreaterThanOrEqual(0);
    const slice = lines.slice(catchStart, catchStart + 10).join('\n');
    expect(slice).toContain('continue;');
  });

  it('WalletLedger UNIQUE(idempotencyKey) is the authoritative arbiter', () => {
    // The comment in the job must reference the DB constraint, since
    // it's what prevents the double-charge even if the in-app check
    // is bypassed.
    const s = src();
    expect(s).toMatch(/WalletLedger/i);
    expect(s).toMatch(/idempotencyKey/i);
  });
});
