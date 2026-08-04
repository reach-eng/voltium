/**
 * Phase 7D PR-120 (DB-IX-1, P1) — covering indexes for hot query paths
 *
 * Why this test exists:
 *   The Phase 7 plan (PR-120) identified 5 missing covering indexes for
 *   hot query paths: outbox_events(status, readyAt), audit_logs(action,
 *   createdAt), support_tickets(status, createdAt), backup_jobs(status,
 *   createdAt), rental_leases(riderId, status, createdAt).
 *
 *   These were confirmed missing on 2026-08-04 via
 *   web/scripts/inspect-indexes.ts. The new migration
 *   20260808000000_covering_indexes_v1 creates all 5 with
 *   CREATE INDEX CONCURRENTLY IF NOT EXISTS.
 *
 * What this test asserts (pure file inspection — no DB required):
 *   1. The migration file exists at the expected path
 *   2. The migration contains all 5 expected CREATE INDEX statements
 *   3. Each CREATE INDEX uses the snake_case table name
 *   4. Each CREATE INDEX uses CONCURRENTLY IF NOT EXISTS (safe on a
 *      non-empty table, idempotent on re-run)
 *   5. The migration does NOT declare these indexes in a BEGIN/COMMIT
 *      block (CONCURRENTLY cannot run inside a transaction)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../prisma/migrations/20260808000000_covering_indexes_v1/migration.sql'
);

const EXPECTED_INDEXES = [
  { table: 'outbox_events', name: 'outbox_events_status_readyAt_idx', cols: ['status', 'readyAt'] },
  { table: 'audit_logs', name: 'audit_logs_action_createdAt_idx', cols: ['action', 'createdAt'] },
  { table: 'support_tickets', name: 'support_tickets_status_createdAt_idx', cols: ['status', 'createdAt'] },
  { table: 'backup_jobs', name: 'backup_jobs_status_createdAt_idx', cols: ['status', 'createdAt'] },
  { table: 'rental_leases', name: 'rental_leases_riderId_status_createdAt_idx', cols: ['riderId', 'status', 'createdAt'] },
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

describe('PR-120: covering indexes for hot query paths', () => {
  const migration = readFileSync(MIGRATION_PATH, 'utf-8');
  const migrationNoComments = stripSqlComments(migration);

  it('migration file exists at the expected path', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  it('migration declares all 5 expected covering indexes', () => {
    for (const idx of EXPECTED_INDEXES) {
      const re = new RegExp(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "${idx.name}"`);
      expect(migration).toMatch(re);
    }
  });

  it('each CREATE INDEX targets the correct snake_case table and columns', () => {
    for (const idx of EXPECTED_INDEXES) {
      const cols = idx.cols.map((c) => `"${c}"`).join(', ');
      const re = new RegExp(`ON "${idx.table}"\\(${cols}\\)`);
      expect(migration).toMatch(re);
    }
  });

  it('every CREATE INDEX uses CONCURRENTLY (safe on non-empty table)', () => {
    // Find all CREATE INDEX statements (with or without CONCURRENTLY).
    // Then assert every one is followed by CONCURRENTLY.
    const createIdxStatements = migrationNoComments.match(/CREATE INDEX[^"]*"[^"]*"/g) || [];
    expect(createIdxStatements.length).toBe(EXPECTED_INDEXES.length);
    for (const stmt of createIdxStatements) {
      expect(stmt).toMatch(/^CREATE INDEX CONCURRENTLY /);
    }
  });

  it('every CREATE INDEX uses IF NOT EXISTS (idempotent on re-run)', () => {
    for (const idx of EXPECTED_INDEXES) {
      const lineRe = new RegExp(`CREATE INDEX CONCURRENTLY IF NOT EXISTS "${idx.name}"`);
      expect(migration).toMatch(lineRe);
    }
  });

  it('migration does NOT wrap statements in a BEGIN/COMMIT (CONCURRENTLY incompatible)', () => {
    expect(migrationNoComments).not.toMatch(/^\s*BEGIN\s*;/m);
    expect(migrationNoComments).not.toMatch(/^\s*COMMIT\s*;/m);
  });

  it('migration targets hot tables — does not touch unrelated tables', () => {
    const tableRefs = new Set<string>();
    const re = /ON "([a-z_]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(migrationNoComments)) !== null) {
      tableRefs.add(m[1]);
    }
    const expected = new Set(EXPECTED_INDEXES.map((e) => e.table));
    expect(tableRefs).toEqual(expected);
  });
});
