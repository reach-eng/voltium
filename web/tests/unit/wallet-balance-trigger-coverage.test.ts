/**
 * PR-150 (B-WL1) — Regression guard for the wallet-balance recompute
 * trigger.
 *
 * The trigger in
 * `web/prisma/migrations/20260808000001_add_wallet_balance_recompute_trigger/migration.sql`
 * is the canonical fix for the wallet/ledger drift P0 (AUDIT_DATABASE
 * §12.1). This test asserts the trigger is wired correctly and the
 * helper function `recompute_wallet_balance` is exposed for batch use.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const MIGRATION = resolve(
  __dirname,
  '../../prisma/migrations/20260808000001_add_wallet_balance_recompute_trigger/migration.sql'
);

function src(): string {
  return readFileSync(MIGRATION, 'utf-8');
}

describe('PR-150: wallet-balance recompute trigger', () => {
  it('migration file exists', () => {
    expect(existsSync(MIGRATION)).toBe(true);
  });

  it('declares the recompute_wallet_balance helper function', () => {
    const s = src();
    expect(s).toMatch(/CREATE OR REPLACE FUNCTION recompute_wallet_balance\(p_rider_id TEXT\)/);
  });

  it('helper excludes the same categories as the TS reconciliation', () => {
    // The category filter MUST match the wallet-reconciliation job's
    // `WHERE` clause (PR-148). Drift between these two is a bug.
    const s = src();
    expect(s).toContain("'SECURITY_DEPOSIT'");
    expect(s).toContain("'FORFEITURE'");
    expect(s).toContain("'REFUND'");
  });

  it('helper applies the sign convention (CREDIT = +, else -)', () => {
    const s = src();
    expect(s).toMatch(/WHEN wl\."entryType" = 'CREDIT' THEN wl\."amountInPaise"\s*ELSE -wl\."amountInPaise"/);
  });

  it('trigger is AFTER INSERT on wallet_ledgers (not BEFORE, to avoid recursion)', () => {
    const s = src();
    expect(s).toMatch(/CREATE TRIGGER trg_recompute_wallet_balance\s+AFTER INSERT ON "wallet_ledgers"/);
  });

  it('trigger is idempotent (DROP TRIGGER IF EXISTS before CREATE)', () => {
    const s = src();
    const dropIdx = s.indexOf('DROP TRIGGER IF EXISTS trg_recompute_wallet_balance');
    const createIdx = s.indexOf('CREATE TRIGGER trg_recompute_wallet_balance');
    expect(dropIdx).toBeGreaterThan(-1);
    expect(createIdx).toBeGreaterThan(-1);
    expect(dropIdx).toBeLessThan(createIdx);
  });

  it('trigger function is named trg_recompute_wallet_balance_on_ledger_insert', () => {
    const s = src();
    expect(s).toContain('CREATE OR REPLACE FUNCTION trg_recompute_wallet_balance_on_ledger_insert()');
  });

  it('initial reconciliation block re-syncs every wallet', () => {
    const s = src();
    // The DO block iterates over `wallets` and calls
    // recompute_wallet_balance for each.
    expect(s).toMatch(/FOR r IN SELECT "riderId" FROM "wallets" LOOP/);
    expect(s).toMatch(/PERFORM recompute_wallet_balance\(r\."riderId"\);/);
  });
});
