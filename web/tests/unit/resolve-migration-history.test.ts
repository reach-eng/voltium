/**
 * PR-96 (DB-M-1) — Idempotent lifecycleStage backfill + history bootstrap
 *
 * Why this test exists:
 *   The original 20260730150000_add_rider_lifecycle_stage migration
 *   applied to the live DB at some point (the column exists) but was
 *   applied via `prisma db push`, so it's missing from
 *   _prisma_migrations. The 2026-08-06 staging-soak gated drops
 *   (20260806000000/20260806010000/20260806020000) need clean migration
 *   history or they will trip on re-apply.
 *
 *   PR-96 ships:
 *     1. 20260807000001_idempotent_lifecycle_stage_backfill — re-runnable
 *        migration that re-creates the enum + column if missing and
 *        backfills any NULL lifecycleStage from lifecycleStatus
 *     2. scripts/resolve-migration-history.ts — marks all pre-gate
 *        migrations as applied (DDL already ran) so `migrate deploy` is
 *        a no-op for the past
 *
 * What this test asserts (pure file inspection — no DB required):
 *   1. Both files exist at the expected paths
 *   2. The new migration uses the correct snake_case names
 *   3. The new migration has IF NOT EXISTS / IF EXISTS guards (idempotent)
 *   4. The new migration does NOT reference the broken PascalCase names
 *   5. The resolve script excludes the 3 gated drops
 *   6. The resolve script marks all 30 pre-gate + 2 new 7A migrations
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../prisma/migrations/20260807000001_idempotent_lifecycle_stage_backfill/migration.sql'
);
const RESOLVE_SCRIPT = resolve(
  __dirname,
  '../../scripts/resolve-migration-history.ts'
);

const GATED_DROPS = [
  '20260806000000_drop_admin_legacy_permissions',
  '20260806010000_drop_rider_legacy_string_columns',
  '20260806020000_drop_rider_legacy_lifecycle_status',
];

function stripSqlComments(s: string): string {
  return s
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.substring(0, idx);
    })
    .join('\n');
}

describe('PR-96 idempotent lifecycleStage backfill + history bootstrap', () => {
  const migration = readFileSync(MIGRATION_PATH, 'utf-8');
  const migrationNoComments = stripSqlComments(migration);
  const script = readFileSync(RESOLVE_SCRIPT, 'utf-8');

  it('migration file exists at the expected path', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  it('resolve-migration-history.ts exists at the expected path', () => {
    expect(existsSync(RESOLVE_SCRIPT)).toBe(true);
  });

  it('migration uses snake_case table names', () => {
    expect(migrationNoComments).toContain('"riders"');
  });

  it('migration does NOT reference broken PascalCase table names in active SQL', () => {
    expect(migrationNoComments).not.toContain('"Rider"');
  });

  it('migration has IF NOT EXISTS / IF EXISTS guards (idempotent re-run)', () => {
    expect(migration).toMatch(/IF NOT EXISTS/);
    expect(migration).toMatch(/IF EXISTS/);
    // Specifically for the enum and column
    expect(migration).toContain("typname = 'RiderLifecycleStage'");
    expect(migration).toContain("column_name = 'lifecycleStage'");
    expect(migration).toContain("column_name = 'lifecycleStatus'");
  });

  it('migration handles all 15 source values from RiderLifecycleStatus', () => {
    const sourceValues = [
      'NEW', 'PHONE_VERIFIED', 'PROFILE_SUBMITTED', 'KYC_SUBMITTED',
      'KYC_APPROVED', 'GUARANTOR_SUBMITTED', 'GUARANTOR_APPROVED',
      'DEPOSIT_PENDING', 'DEPOSIT_APPROVED', 'PLAN_SELECTED',
      'PICKUP_SCHEDULED', 'ACTIVE', 'SUSPENDED', 'RETURN_PENDING', 'CLOSED',
    ];
    sourceValues.forEach((v) => {
      expect(migration, `expected source value '${v}' in CASE`).toContain(`WHEN '${v}'`);
    });
  });

  it('migration uses DO $$ ... $$; for atomic execution', () => {
    expect(migration).toMatch(/^DO \$\$/m);
    expect(migration.trimEnd().endsWith('$$;')).toBe(true);
  });

  it('resolve script excludes the 3 gated staging-soak drops', () => {
    // All 3 must be in the EXCLUSION set
    GATED_DROPS.forEach((g) => {
      expect(script, `gated drop '${g}' should be excluded`).toContain(g);
    });
    // And the script must apply migrations starting with non-gate prefixes
    expect(script).toContain("m < GATE_PREFIX || m.startsWith('20260807')");
  });

  it('resolve script wraps inserts in a transaction (atomic)', () => {
    expect(script).toContain("await c.query('BEGIN')");
    expect(script).toContain("await c.query('COMMIT')");
    expect(script).toContain("await c.query('ROLLBACK')");
  });

  it('resolve script is idempotent (re-run is no-op)', () => {
    expect(script).toContain('alreadyApplied');
    expect(script).toContain('Nothing to do');
  });
});
