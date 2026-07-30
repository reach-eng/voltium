/**
 * PR-K.1 — Rider lifecycle stage enum + column migration guard.
 *
 * Validates the structure of
 *   prisma/migrations/20260730150000_add_rider_lifecycle_stage/migration.sql
 *
 * This migration adds the RiderLifecycleStage enum (5 values) + a
 * `lifecycleStage` column on the Rider table, then backfills
 * `lifecycleStage` from the existing 15-value `lifecycleStatus` enum.
 * The legacy `lifecycleStatus` column is KEPT in this PR (it's dropped
 * in PR-K.3, gated on a 1-week staging soak after this PR ships).
 *
 * The script is idempotent (DO $$ ... $$; with IF NOT EXISTS guards) so
 * it's safe to re-run on staging.
 *
 * Run: npx vitest run tests/unit/rider-lifecycle-stage-migration.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const MIGRATION_DIR = resolve(
  __dirname,
  '../../prisma/migrations/20260730150000_add_rider_lifecycle_stage'
);
const MIGRATION_SQL = resolve(MIGRATION_DIR, 'migration.sql');
const SCHEMA_PATH = resolve(__dirname, '../../prisma/schema.prisma');

describe('PR-K.1 Rider lifecycle stage migration', () => {
  const sql = existsSync(MIGRATION_SQL) ? readFileSync(MIGRATION_SQL, 'utf-8') : '';
  const schema = existsSync(SCHEMA_PATH) ? readFileSync(SCHEMA_PATH, 'utf-8') : '';

  it('migration directory and SQL file exist', () => {
    expect(existsSync(MIGRATION_DIR)).toBe(true);
    expect(existsSync(MIGRATION_SQL)).toBe(true);
    expect(sql.length).toBeGreaterThan(500);
  });

  it('wraps the work in DO $$ ... $$; for procedural control', () => {
    expect(sql).toMatch(/DO\s+\$\$/);
    expect(sql).toMatch(/END\s+\$\$/);
  });

  it('is idempotent — uses IF NOT EXISTS guards for enum + column + backfill', () => {
    // Enum creation guard
    expect(sql).toMatch(/CREATE\s+TYPE\s+"RiderLifecycleStage".*IF\s+NOT\s+EXISTS/s);
    // Column add guard
    expect(sql).toMatch(/ADD\s+COLUMN\s+"lifecycleStage".*IF\s+NOT\s+EXISTS/s);
    // Backfill WHERE clause excludes already-mapped rows
    expect(sql).toMatch(/WHERE\s+"lifecycleStage"\s*=\s*'NEW'/);
  });

  describe('RiderLifecycleStage enum', () => {
    it('creates the 5-value enum', () => {
      expect(sql).toMatch(/CREATE\s+TYPE\s+"RiderLifecycleStage"\s+AS\s+ENUM/);
      expect(sql).toMatch(/'NEW'/);
      expect(sql).toMatch(/'IN_PROGRESS'/);
      expect(sql).toMatch(/'ACTIVE'/);
      expect(sql).toMatch(/'PAUSED'/);
      expect(sql).toMatch(/'CLOSED'/);
    });

    it('enum values match the schema.prisma definition', () => {
      const enumMatch = schema.match(
        /enum\s+RiderLifecycleStage\s*\{([^}]+)\}/
      );
      expect(enumMatch).toBeTruthy();
      const enumBody = enumMatch![1];
      for (const value of ['NEW', 'IN_PROGRESS', 'ACTIVE', 'PAUSED', 'CLOSED']) {
        expect(enumBody).toContain(`  ${value}`);
        expect(sql).toContain(`'${value}'`);
      }
    });
  });

  describe('lifecycleStage column', () => {
    it('adds lifecycleStage to the Rider table', () => {
      expect(sql).toMatch(
        /ALTER\s+TABLE\s+"Rider"\s+ADD\s+COLUMN\s+"lifecycleStage"\s+"RiderLifecycleStage"/
      );
    });

    it('defaults to NEW', () => {
      expect(sql).toMatch(/DEFAULT\s+'NEW'/);
    });

    it('matches the schema.prisma column definition', () => {
      expect(schema).toMatch(
        /lifecycleStage\s+RiderLifecycleStage\?\s+@default\(NEW\)/
      );
    });
  });

  describe('backfill from lifecycleStatus', () => {
    it('backfills all 15 lifecycleStatus values', () => {
      const stages = [
        'NEW',
        'PHONE_VERIFIED',
        'PROFILE_SUBMITTED',
        'KYC_SUBMITTED',
        'KYC_APPROVED',
        'GUARANTOR_SUBMITTED',
        'GUARANTOR_APPROVED',
        'DEPOSIT_PENDING',
        'DEPOSIT_APPROVED',
        'PLAN_SELECTED',
        'PICKUP_SCHEDULED',
        'ACTIVE',
        'SUSPENDED',
        'RETURN_PENDING',
        'CLOSED',
      ];
      for (const s of stages) {
        expect(sql).toContain(`WHEN '${s}'`);
      }
    });

    it('maps outcome states (ACTIVE, CLOSED, SUSPENDED, RETURN_PENDING) to the right stage', () => {
      expect(sql).toMatch(/WHEN\s+'ACTIVE'.*THEN\s+'ACTIVE'/s);
      expect(sql).toMatch(/WHEN\s+'SUSPENDED'.*THEN\s+'PAUSED'/s);
      expect(sql).toMatch(/WHEN\s+'RETURN_PENDING'.*THEN\s+'PAUSED'/s);
      expect(sql).toMatch(/WHEN\s+'CLOSED'.*THEN\s+'CLOSED'/s);
    });

    it('maps in-progress states to IN_PROGRESS', () => {
      // PHONE_VERIFIED, PROFILE_SUBMITTED, KYC_*, GUARANTOR_*, DEPOSIT_*,
      // PLAN_SELECTED, PICKUP_SCHEDULED, KYC_APPROVED, GUARANTOR_APPROVED
      const inProgress = [
        'PHONE_VERIFIED',
        'PROFILE_SUBMITTED',
        'KYC_SUBMITTED',
        'KYC_APPROVED',
        'GUARANTOR_SUBMITTED',
        'GUARANTOR_APPROVED',
        'DEPOSIT_PENDING',
        'DEPOSIT_APPROVED',
        'PLAN_SELECTED',
        'PICKUP_SCHEDULED',
      ];
      for (const s of inProgress) {
        expect(sql).toMatch(
          new RegExp(`WHEN\\s+'${s}'.*THEN\\s+'IN_PROGRESS'`, 's')
        );
      }
    });

    it('keeps the legacy lifecycleStatus column (does NOT drop it)', () => {
      // PR-K.1 keeps lifecycleStatus; PR-K.3 (later) drops it.
      expect(sql).not.toMatch(/DROP\s+COLUMN\s+"lifecycleStatus"/);
    });
  });

  describe('cross-file consistency', () => {
    it('schema.prisma has both lifecycleStatus and lifecycleStage', () => {
      expect(schema).toMatch(/lifecycleStatus\s+RiderLifecycleStatus/);
      expect(schema).toMatch(/lifecycleStage\s+RiderLifecycleStage/);
    });

    it('migration file path matches the timestamp convention', () => {
      expect(MIGRATION_DIR).toMatch(/20260730150000/);
    });
  });
});
