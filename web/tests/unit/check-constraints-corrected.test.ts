/**
 * PR-97 (DB-C-1) — Corrected CHECK constraints migration
 *
 * Why this test exists:
 *   The original 20260729160000_add_check_constraints migration targeted
 *   PascalCase tables ("Rider", "KycProfile") that no longer exist after
 *   20260712000002_standardize_table_naming renamed them to snake_case.
 *   Every ALTER TABLE inside the original DO $$ block failed with
 *   "relation Rider does not exist", so ZERO CHECK constraints were
 *   ever applied to the live DB. Verified by inspect-constraints.ts.
 *
 *   PR-97 ships a corrected migration that:
 *     - Uses the standardized snake_case table names (riders, kyc_profiles, etc.)
 *     - Adds 12 constraints (original 11 + wallet_deposit_nonnegative)
 *     - Wraps each ALTER in `IF NOT EXISTS (pg_constraint)` guards
 *     - Catches per-constraint errors so one bad constraint doesn't abort
 *
 * What this test asserts (pure file inspection — no DB required):
 *   1. Migration file exists at the expected path
 *   2. Uses snake_case table names (riders, kyc_profiles, wallets, etc.)
 *   3. Does NOT reference the broken PascalCase names (Rider, KycProfile)
 *   4. Has 12 distinct constraint names defined
 *   5. Every constraint has an IF NOT EXISTS guard
 *   6. Every ALTER TABLE is wrapped in BEGIN/EXCEPTION so partial failure is safe
 *
 * What this test does NOT cover (covered by the live apply script + staging soak):
 *   - Actual enforcement (SQLSTATE 23514 on bad data) — tested in staging
 *   - Cross-DB compatibility — assumed (the IF NOT EXISTS pattern is portable)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../prisma/migrations/20260807000000_add_check_constraints_corrected/migration.sql'
);

const REQUIRED_CONSTRAINTS = [
  'rider_battery_level_range',
  'rider_phone_format',
  'rider_email_format',
  'kyc_aadhaar_format',
  'kyc_pan_format',
  'kyc_ifsc_format',
  'wallet_balance_nonnegative',
  'wallet_deposit_nonnegative',
  'outbox_attempts_cap',
  'rental_plan_duration_matches_type',
  'backup_schedule_time_format',
  'idempotency_expiry_after_create',
];

const FORBIDDEN_PASCALCASE_TABLES = ['"Rider"', '"KycProfile"', '"Wallet"', '"OutboxEvent"', '"RentalPlan"'];
const REQUIRED_SNAKECASE_TABLES = ['"riders"', '"kyc_profiles"', '"wallets"', '"outbox_events"', '"rental_plans"'];

/**
 * Strip SQL line comments (-- to EOL) so the regex checks only active SQL,
 * not the audit-trail comments at the top of the file.
 */
function stripSqlComments(s: string): string {
  return s
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.substring(0, idx);
    })
    .join('\n');
}

describe('PR-97 corrected CHECK constraints migration', () => {
  const sql = readFileSync(MIGRATION_PATH, 'utf-8');
  const sqlNoComments = stripSqlComments(sql);

  it('migration file exists at the expected path', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  it('uses snake_case table names (the standardized schema)', () => {
    REQUIRED_SNAKECASE_TABLES.forEach((t) => {
      expect(sqlNoComments).toContain(t);
    });
  });

  it('does NOT reference the broken PascalCase table names in active SQL', () => {
    FORBIDDEN_PASCALCASE_TABLES.forEach((t) => {
      expect(sqlNoComments).not.toContain(t);
    });
  });

  it('defines all 12 required constraints', () => {
    REQUIRED_CONSTRAINTS.forEach((c) => {
      // Each constraint name must appear in an ADD CONSTRAINT clause
      const pattern = new RegExp(`ADD CONSTRAINT ${c}\\b`);
      expect(sql, `expected constraint '${c}' to be defined`).toMatch(pattern);
    });
  });

  it('every constraint has an IF NOT EXISTS guard (idempotent re-run)', () => {
    REQUIRED_CONSTRAINTS.forEach((c) => {
      // Each IF NOT EXISTS block should mention the constraint name within ~20 lines
      const ifNotExistsPattern = new RegExp(
        `IF NOT EXISTS \\(SELECT 1 FROM pg_constraint WHERE conname = '${c}'\\)`
      );
      expect(sql, `expected IF NOT EXISTS guard for '${c}'`).toMatch(ifNotExistsPattern);
    });
  });

  it('per-constraint errors are isolated (BEGIN/EXCEPTION blocks present)', () => {
    // Count BEGIN...EXCEPTION WHEN OTHERS pairs (must be at least 12, one per constraint)
    const beginMatches = sql.match(/BEGIN\b/g) || [];
    const exceptionMatches = sql.match(/EXCEPTION WHEN OTHERS THEN/g) || [];
    expect(beginMatches.length).toBeGreaterThanOrEqual(12);
    expect(exceptionMatches.length).toBeGreaterThanOrEqual(12);
  });

  it('uses DO $$ ... $$; wrapper for atomic execution', () => {
    expect(sql).toMatch(/^DO \$\$/m);
    expect(sql.trimEnd().endsWith('$$;')).toBe(true);
  });

  it('PR-97 has the expected number of constraints (regression guard)', () => {
    // If new constraints are added in this migration, the count above must be updated
    // AND the test below should reflect the new total.
    const constraintDefPattern = /ADD CONSTRAINT (\w+)/g;
    const matches = [...sql.matchAll(constraintDefPattern)].map((m) => m[1]);
    const unique = new Set(matches);
    expect(unique.size).toBe(12);
  });
});
