/**
 * Phase 7D PR-122 (DB-ENC-1, P1) — pgcrypto extension enabled
 *
 * Why this test exists:
 *   The Phase 7 plan (PR-122) called for verifying that the pgcrypto
 *   extension is enabled on the dev DB. The extension is needed for
 *   `pgp_sym_encrypt` / `pgp_sym_decrypt` (used by the future
 *   column-level encryption_at_rest story — see Phase 7D intro), and
 *   for `gen_random_bytes` (already used by _prisma_migrations.id).
 *
 *   Verified 2026-08-04 via web/scripts/inspect-extensions.ts: the
 *   extension was NOT enabled (only `plpgsql` was in pg_extension).
 *
 *   The new migration 20260808000002_enable_pgcrypto adds
 *   `CREATE EXTENSION IF NOT EXISTS pgcrypto`. After apply, both
 *   `pgp_sym_encrypt` roundtrip and `gen_random_bytes(8)` work.
 *
 * What this test asserts (pure file inspection + a live DB roundtrip):
 *   1. The migration file exists at the expected path
 *   2. The migration uses CREATE EXTENSION IF NOT EXISTS (idempotent)
 *   3. The migration enables the `pgcrypto` extension (not a different one)
 *   4. The live DB has pgcrypto enabled (live check — runs against the
 *      dev DB; mirrors what a real column-encryption migration would
 *      need)
 *   5. pgcrypto's gen_random_bytes function is callable
 *   6. pgcrypto's pgp_sym_encrypt + pgp_sym_decrypt roundtrip works
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { Client } from 'pg';
import { resolve } from 'path';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MIGRATION_PATH = resolve(
  __dirname,
  '../../prisma/migrations/20260808000002_enable_pgcrypto/migration.sql'
);

function stripSqlComments(s: string): string {
  return s
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.substring(0, idx);
    })
    .join('\n');
}

describe('PR-122: pgcrypto extension enabled', () => {
  const migration = readFileSync(MIGRATION_PATH, 'utf-8');
  const migrationNoComments = stripSqlComments(migration);

  it('migration file exists at the expected path', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  it('migration uses CREATE EXTENSION IF NOT EXISTS (idempotent)', () => {
    expect(migration).toMatch(/CREATE EXTENSION IF NOT EXISTS pgcrypto/);
  });

  it('migration enables the pgcrypto extension (not a different one)', () => {
    expect(migrationNoComments).toContain('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    // No other extensions
    const extMatches = migrationNoComments.match(/CREATE EXTENSION[^;]*/g) || [];
    expect(extMatches.length).toBe(1);
    expect(extMatches[0]).toMatch(/pgcrypto/);
  });

  // Live-DB tests below run against the dev DB. They mirror the
  // integration pattern in web/tests/integration/. We use a simple
  // Client (no Prisma) so the test is fast and self-contained.
  describe('live DB checks (require dev DB at $DATABASE_URL)', () => {
    it('pgcrypto extension is enabled in pg_extension', async () => {
      const c = new Client({ connectionString: process.env.DATABASE_URL });
      await c.connect();
      const r = await c.query(
        "SELECT extname FROM pg_extension WHERE extname = 'pgcrypto'"
      );
      await c.end();
      expect(r.rows.length).toBe(1);
    });

    it('gen_random_bytes(8) is callable (pgcrypto function)', async () => {
      const c = new Client({ connectionString: process.env.DATABASE_URL });
      await c.connect();
      const r = await c.query("SELECT encode(gen_random_bytes(8), 'hex') AS r");
      await c.end();
      // 8 bytes -> 16 hex chars
      expect(r.rows[0].r).toMatch(/^[0-9a-f]{16}$/);
    });

    it('pgp_sym_encrypt + pgp_sym_decrypt roundtrip works', async () => {
      const c = new Client({ connectionString: process.env.DATABASE_URL });
      await c.connect();
      const enc = await c.query(
        "SELECT encode(pgp_sym_encrypt('phase7d-pii-test', 'unit-test-key'), 'hex') AS c"
      );
      const dec = await c.query(
        "SELECT pgp_sym_decrypt(decode($1, 'hex'), 'unit-test-key') AS p",
        [enc.rows[0].c]
      );
      await c.end();
      expect(dec.rows[0].p).toBe('phase7d-pii-test');
    });
  });
});
