/**
 * PR-P3.2 — Rider FK column migration guard.
 *
 * Validates the structure of
 *   prisma/migrations/20260730140000_add_rider_fk_columns/migration.sql
 *
 * This migration adds 3 FK columns to Rider (pickupHubId, currentPlanId,
 * teamLeaderId), backfills them from the legacy string columns, and adds
 * 3 FK constraints + 3 indexes. Legacy string columns are KEPT in this PR
 * (they're dropped in PR-P3.3, gated on a 1-week staging soak after this
 * PR ships).
 *
 * The script is gated on a 1-week staging soak before PR-P3.3 (the drop
 * step). This test prevents accidental regressions: if someone deletes a
 * column block, breaks the backfill, drops a constraint, or breaks
 * idempotency, the test catches it before the next staging push.
 *
 * Run: npx vitest run tests/unit/rider-fk-columns-migration.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const MIGRATION_DIR = resolve(
  __dirname,
  '../../prisma/migrations/20260730140000_add_rider_fk_columns'
);
const MIGRATION_SQL = resolve(MIGRATION_DIR, 'migration.sql');
const SCHEMA_PATH = resolve(__dirname, '../../prisma/schema.prisma');

describe('PR-P3.2 Rider FK column migration', () => {
  const sql = existsSync(MIGRATION_SQL) ? readFileSync(MIGRATION_SQL, 'utf-8') : '';
  const schema = existsSync(SCHEMA_PATH) ? readFileSync(SCHEMA_PATH, 'utf-8') : '';

  it('migration directory and SQL file exist', () => {
    expect(existsSync(MIGRATION_DIR)).toBe(true);
    expect(existsSync(MIGRATION_SQL)).toBe(true);
    expect(sql.length).toBeGreaterThan(500);
  });

  it('wraps the column work in DO $$ ... $$; for procedural control', () => {
    expect(sql).toMatch(/DO\s+\$\$/);
    expect(sql).toMatch(/END\s+\$\$/);
  });

  describe('three new FK columns', () => {
    it('adds pickupHubId', () => {
      expect(sql).toMatch(/ALTER\s+TABLE\s+"riders"\s+ADD\s+COLUMN\s+"pickupHubId"\s+TEXT/);
    });

    it('adds currentPlanId', () => {
      expect(sql).toMatch(/ALTER\s+TABLE\s+"riders"\s+ADD\s+COLUMN\s+"currentPlanId"\s+TEXT/);
    });

    it('adds teamLeaderId', () => {
      expect(sql).toMatch(/ALTER\s+TABLE\s+"riders"\s+ADD\s+COLUMN\s+"teamLeaderId"\s+TEXT/);
    });
  });

  describe('three FK constraints (idempotent)', () => {
    it('adds riders_pickupHubId_fkey -> hubs(id) ON DELETE SET NULL', () => {
      expect(sql).toContain('riders_pickupHubId_fkey');
      expect(sql).toMatch(
        /riders_pickupHubId_fkey[\s\S]+FOREIGN\s+KEY\s*\("pickupHubId"\)\s+REFERENCES\s+"hubs"\("id"\)\s+ON\s+DELETE\s+SET\s+NULL/i
      );
    });

    it('adds riders_currentPlanId_fkey -> rental_plans(id) ON DELETE SET NULL', () => {
      expect(sql).toContain('riders_currentPlanId_fkey');
      expect(sql).toMatch(
        /riders_currentPlanId_fkey[\s\S]+FOREIGN\s+KEY\s*\("currentPlanId"\)\s+REFERENCES\s+"rental_plans"\("id"\)\s+ON\s+DELETE\s+SET\s+NULL/i
      );
    });

    it('adds riders_teamLeaderId_fkey -> team_leaders(id) ON DELETE SET NULL', () => {
      expect(sql).toContain('riders_teamLeaderId_fkey');
      expect(sql).toMatch(
        /riders_teamLeaderId_fkey[\s\S]+FOREIGN\s+KEY\s*\("teamLeaderId"\)\s+REFERENCES\s+"team_leaders"\("id"\)\s+ON\s+DELETE\s+SET\s+NULL/i
      );
    });
  });

  describe('mixed-type backfill strategy', () => {
    it('pickupHubId backfill tries ID match, then name match, then NULL', () => {
      // The audit verified the legacy column has been used as BOTH a Hub
      // name and a Hub ID. The backfill must try both lookups.
      expect(sql).toMatch(/FROM\s+"hubs"\s+h\s+WHERE\s+h\.id\s*=\s*r\."pickupHub"/);
      expect(sql).toMatch(/FROM\s+"hubs"\s+h\s+WHERE\s+h\.name\s*=\s*r\."pickupHub"/);
      // COALESCE wraps both subqueries; when neither matches the second
      // subquery returns NULL, so the resolved_id is NULL.
      expect(sql).toMatch(/COALESCE\(\s*\(SELECT\s+h\.id[\s\S]*WHERE\s+h\.id[\s\S]*\(SELECT\s+h\.id[\s\S]*WHERE\s+h\.name/);
    });

    it('currentPlanId backfill tries ID match, then name match, then NULL', () => {
      expect(sql).toMatch(/FROM\s+"rental_plans"\s+p\s+WHERE\s+p\.id\s*=\s*r\."currentPlan"/);
      expect(sql).toMatch(/FROM\s+"rental_plans"\s+p\s+WHERE\s+p\.name\s*=\s*r\."currentPlan"/);
    });

    it('teamLeaderId backfill is ID-only (verified clean by audit)', () => {
      // The audit verified teamLeader writers all use TeamLeader.id.
      // There should be NO name-match fallback for this column. The
      // SQL has only an id-match lookup against "team_leaders".
      expect(sql).toMatch(/FROM\s+"team_leaders"\s+t\s+WHERE\s+t\.id\s*=\s*r\."teamLeader"/);
      // No name fallback — the team_leaders table should never be queried
      // with t.name = r."teamLeader" (the legacy column).
      const nameFallback = sql.match(/FROM\s+"team_leaders"\s+t\s+WHERE\s+t\.name\s*=\s*r\."teamLeader"/);
      expect(nameFallback).toBeNull();
    });

    it('does NOT crash on unmapped values — defaults to NULL', () => {
      // The "default to NULL" decision (per audit ticket): every backfill
      // wraps the lookup in COALESCE so a missing target becomes NULL.
      const coalesceCount = (sql.match(/COALESCE\(/g) || []).length;
      // 1 per column = 3 minimum
      expect(coalesceCount).toBeGreaterThanOrEqual(3);
    });
  });

  describe('idempotency (safe to re-run on staging)', () => {
    it('guards each column-add with information_schema check', () => {
      const addChecks = sql.match(/IF\s+NOT\s+EXISTS[\s\S]*?information_schema\.columns[\s\S]*?column_name\s*=\s*'(pickupHubId|currentPlanId|teamLeaderId)'/g) || [];
      expect(addChecks.length).toBe(3);
    });

    it('guards each FK constraint with pg_constraint check', () => {
      const fkChecks = sql.match(/IF\s+NOT\s+EXISTS[\s\S]*?pg_constraint[\s\S]*?conname\s*=\s*'(riders_pickupHubId_fkey|riders_currentPlanId_fkey|riders_teamLeaderId_fkey)'/g) || [];
      expect(fkChecks.length).toBe(3);
    });

    it('guards each new index with pg_indexes check', () => {
      const idxChecks = sql.match(/IF\s+NOT\s+EXISTS[\s\S]*?pg_indexes[\s\S]*?indexname\s*=\s*'(riders_pickupHubId_idx|riders_currentPlanId_idx|riders_teamLeaderId_idx)'/g) || [];
      expect(idxChecks.length).toBe(3);
    });
  });

  describe('three new indexes on the FK columns', () => {
    it('creates riders_pickupHubId_idx', () => {
      expect(sql).toMatch(/CREATE\s+INDEX\s+"riders_pickupHubId_idx"\s+ON\s+"riders"\s*\("pickupHubId"\)/);
    });

    it('creates riders_currentPlanId_idx', () => {
      expect(sql).toMatch(/CREATE\s+INDEX\s+"riders_currentPlanId_idx"\s+ON\s+"riders"\s*\("currentPlanId"\)/);
    });

    it('creates riders_teamLeaderId_idx', () => {
      expect(sql).toMatch(/CREATE\s+INDEX\s+"riders_teamLeaderId_idx"\s+ON\s+"riders"\s*\("teamLeaderId"\)/);
    });
  });

  describe('KEEP legacy columns (PR-P3.3 is the drop step)', () => {
    it('does NOT drop pickupHub / currentPlan / teamLeader', () => {
      // The plan: PR-P3.2 adds FK columns; PR-P3.3 drops legacy columns.
      // If a future edit accidentally drops them in this PR, the test fails.
      const dropMatches = sql.match(/ALTER\s+TABLE\s+"riders"\s+DROP\s+COLUMN\s+"(pickupHub|currentPlan|teamLeader)"/g) || [];
      expect(dropMatches.length).toBe(0);
    });
  });

  describe('schema is in sync — Prisma has 3 new FK fields + relations', () => {
    it('Rider model has pickupHubId String?', () => {
      expect(schema).toMatch(/model\s+Rider[\s\S]+pickupHubId\s+String\?/);
    });

    it('Rider model has currentPlanId String?', () => {
      expect(schema).toMatch(/model\s+Rider[\s\S]+currentPlanId\s+String\?/);
    });

    it('Rider model has teamLeaderId String?', () => {
      expect(schema).toMatch(/model\s+Rider[\s\S]+teamLeaderId\s+String\?/);
    });

    it('Rider declares pickupHubRef relation -> Hub', () => {
      expect(schema).toMatch(/pickupHubRef\s+Hub\?[\s\S]+@relation\("RiderPickupHub"/);
    });

    it('Rider declares currentPlanRef relation -> RentalPlan', () => {
      expect(schema).toMatch(/currentPlanRef\s+RentalPlan\?[\s\S]+@relation\("RiderCurrentPlan"/);
    });

    it('Rider declares teamLeaderRef relation -> TeamLeader', () => {
      expect(schema).toMatch(/teamLeaderRef\s+TeamLeader\?[\s\S]+@relation\("RiderTeamLeader"/);
    });

    it('Hub declares Rider back-relation', () => {
      expect(schema).toMatch(/model\s+Hub[\s\S]+pickupHubRiders\s+Rider\[\][\s\S]+@relation\("RiderPickupHub"\)/);
    });

    it('RentalPlan declares Rider back-relation', () => {
      expect(schema).toMatch(/model\s+RentalPlan[\s\S]+currentPlanRiders\s+Rider\[\][\s\S]+@relation\("RiderCurrentPlan"\)/);
    });

    it('TeamLeader declares Rider back-relation', () => {
      expect(schema).toMatch(/model\s+TeamLeader[\s\S]+teamLeaderRiders\s+Rider\[\][\s\S]+@relation\("RiderTeamLeader"\)/);
    });
  });
});
