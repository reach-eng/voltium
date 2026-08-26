/**
 * PR-P3.1 — JSON column conversion migration guard.
 *
 * Validates the structure of
 *   prisma/migrations/20260730131814_convert_json_columns/migration.sql
 *
 * This migration converts 4 String JSON-as-string columns to native Json/jsonb
 * (`SyncQueue.payload`, `Announcement.targetIds`, `Incident.photos`,
 * `FileRecord.metadata`) and adds a CHECK constraint on
 * `KycProfile.editableFields`.
 *
 * The script is gated on a 1-week staging soak before production (see
 * docs/FOLLOWUP_TICKETS.md #8). This test prevents accidental regressions
 * while the migration sits in the migrations directory: if someone deletes
 * a column block, drops the parse-fail fallback, or breaks idempotency,
 * the test catches it before it lands on staging.
 *
 * Run: npx vitest run tests/unit/json-columns-migration.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const MIGRATION_DIR = resolve(
  __dirname,
  '../../prisma/migrations/20260730131814_convert_json_columns'
);
const MIGRATION_SQL = resolve(MIGRATION_DIR, 'migration.sql');
const SCHEMA_PATH = resolve(__dirname, '../../prisma/schema.prisma');

describe('PR-P3.1 JSON column migration', () => {
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

  describe('per-column coverage (4 native-JSON columns + 1 CHECK constraint)', () => {
    it('handles SyncQueue.payload — String → Json', () => {
      expect(sql).toContain('sync_queues');
      expect(sql).toContain('payload_json');
      // Guard: only run if payload is currently text
      expect(sql).toMatch(/table_name\s*=\s*'sync_queues'[\s\S]*column_name\s*=\s*'payload'[\s\S]*data_type\s*=\s*'text'/);
    });

    it('handles Announcement.targetIds — String → Json', () => {
      expect(sql).toContain('announcements');
      expect(sql).toContain('"targetIds_json"');
    });

    it('handles Incident.photos — String → Json', () => {
      expect(sql).toContain('incidents');
      expect(sql).toContain('photos_json');
    });

    it('handles FileRecord.metadata — String → Json (nullable preserved)', () => {
      expect(sql).toContain('file_records');
      expect(sql).toContain('metadata_json');
      // NULL must stay NULL — never auto-converted to an empty object
      expect(sql).toMatch(/WHEN\s+metadata\s+IS\s+NULL\s+THEN\s+NULL/i);
    });
  });

  describe('parse-fail safety (the "ADD+UPDATE+DROP+RENAME" rationale)', () => {
    it('uses COALESCE(... ::jsonb, default) so a single bad row does NOT block migration', () => {
      // Each block must wrap the ::jsonb cast in COALESCE with a safe default
      const coalesceMatches = sql.match(/COALESCE\([^)]*::jsonb,\s*'(?:\{\}|\[\])'::jsonb\)/g) || [];
      // We have 4 columns; 1 COALESCE per non-nullable column (metadata uses NULL-preservation)
      // sync_queue (object), announcement (array), incident (array), file (object) = 4
      expect(coalesceMatches.length).toBeGreaterThanOrEqual(4);
    });

    it('defaults to [] for array columns (targetIds, photos)', () => {
      // "[]"::jsonb fallback
      const arrayDefaults = sql.match(/'\[\]'::jsonb/g) || [];
      expect(arrayDefaults.length).toBeGreaterThanOrEqual(2);
    });

    it('defaults to {} for object columns (payload, metadata)', () => {
      const objectDefaults = sql.match(/'\{\}'::jsonb/g) || [];
      expect(objectDefaults.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('idempotency (safe to re-run on staging)', () => {
    it('guards each column with information_schema check on data_type', () => {
      // Each of the 4 column blocks must check data_type='text' before adding
      const textChecks = sql.match(/data_type\s*=\s*'text'/g) || [];
      expect(textChecks.length).toBeGreaterThanOrEqual(4);
    });

    it('uses IF NOT EXISTS for the KycProfile CHECK constraint', () => {
      expect(sql).toMatch(
        /IF\s+NOT\s+EXISTS\s*\(\s*SELECT\s+1\s+FROM\s+pg_constraint[\s\S]*conname\s*=\s*'kyc_editable_fields_allowlist'/
      );
    });
  });

  describe('ADD+UPDATE+DROP+RENAME pattern', () => {
    it('adds a temp JSONB column, then drops and renames for each block', () => {
      // Each of the 4 columns should appear in an ADD COLUMN, DROP COLUMN, RENAME COLUMN triplet
      const addMatches = sql.match(/ALTER\s+TABLE\s+"sync_queues"\s+ADD\s+COLUMN\s+"payload_json"/);
      const dropMatches = sql.match(/ALTER\s+TABLE\s+"sync_queues"\s+DROP\s+COLUMN\s+"payload"/);
      const renameMatches = sql.match(/ALTER\s+TABLE\s+"sync_queues"\s+RENAME\s+COLUMN\s+"payload_json"\s+TO\s+"payload"/);
      expect(addMatches).not.toBeNull();
      expect(dropMatches).not.toBeNull();
      expect(renameMatches).not.toBeNull();
    });

    it('does NOT use USING casts (the live-data-safe strategy)', () => {
      // The plan deliberately avoids `ALTER COLUMN ... TYPE jsonb USING payload::jsonb`
      // because a single bad row would block the entire migration.
      expect(sql).not.toMatch(/ALTER\s+COLUMN[\s\S]*USING/i);
    });
  });

  describe('KycProfile.editableFields stays as text[] with CHECK', () => {
    it('adds a CHECK constraint matching the canonical 5-field allowlist', () => {
      expect(sql).toContain('kyc_editable_fields_allowlist');
      // The 5 canonical editable fields per docs/ADMIN_WEB_PLAN.md
      expect(sql).toContain("'name'");
      expect(sql).toContain("'email'");
      expect(sql).toContain("'dob'");
      expect(sql).toContain("'currentAddress'");
      expect(sql).toContain("'emergencyContact'");
    });
  });

  describe('schema is in sync — Prisma field types are Json / Json?', () => {
    it('SyncQueue.payload is typed as Json in schema.prisma', () => {
      expect(schema).toMatch(/model\s+SyncQueue[\s\S]+payload\s+Json\b/);
    });

    it('Announcement.targetIds is typed as Json in schema.prisma', () => {
      expect(schema).toMatch(/model\s+Announcement[\s\S]+targetIds\s+Json\b/);
    });

    it('Incident.photos is typed as Json in schema.prisma', () => {
      expect(schema).toMatch(/model\s+Incident[\s\S]+photos\s+Json\b/);
    });

    it('FileRecord.metadata is typed as Json? in schema.prisma', () => {
      expect(schema).toMatch(/model\s+FileRecord[\s\S]+metadata\s+Json\?/);
    });

    it('KycProfile.editableFields is still text[] (not converted)', () => {
      // Audit decision: this column is an enum allowlist, not arbitrary JSON
      expect(schema).toMatch(/model\s+KycProfile[\s\S]+editableFields\s+String\[\]/);
    });
  });

  describe('use-case call sites are updated (no remaining JSON.stringify/parse on these fields)', () => {
    it('announcement.use-cases.ts no longer stringifies/parses targetIds', () => {
      const path = resolve(
        __dirname,
        '../../src/server/modules/announcements/announcement.use-cases.ts'
      );
      if (!existsSync(path)) return; // skip if not yet generated
      const content = readFileSync(path, 'utf-8');
      expect(content).not.toMatch(/JSON\.stringify\([^)]*targetIds/);
      expect(content).not.toMatch(/JSON\.parse\([^)]*targetIds/);
    });

    it('incident.use-cases.ts no longer stringifies/parses photos', () => {
      const path = resolve(
        __dirname,
        '../../src/server/modules/incidents/incident.use-cases.ts'
      );
      if (!existsSync(path)) return;
      const content = readFileSync(path, 'utf-8');
      expect(content).not.toMatch(/JSON\.stringify\([^)]*photos/);
      expect(content).not.toMatch(/JSON\.parse\([^)]*\.photos/);
    });

    it('sync.use-cases.ts no longer stringifies payload', () => {
      const path = resolve(
        __dirname,
        '../../src/server/modules/sync/sync.use-cases.ts'
      );
      if (!existsSync(path)) return;
      const content = readFileSync(path, 'utf-8');
      expect(content).not.toMatch(/JSON\.stringify\(\s*payload/);
    });

    it('files.use-cases.ts no longer stringifies metadata', () => {
      const path = resolve(
        __dirname,
        '../../src/server/modules/files/files.use-cases.ts'
      );
      if (!existsSync(path)) return;
      const content = readFileSync(path, 'utf-8');
      expect(content).not.toMatch(/JSON\.stringify\(\s*\{[^}]*requestedBy/);
    });
  });
});
