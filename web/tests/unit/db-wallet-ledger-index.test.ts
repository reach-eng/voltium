/**
 * Phase 7D PR-121 (DB-IX-2, P1) — wallet_ledgers(riderId, createdAt) covering index
 *
 * Why this test exists:
 *   The Phase 7 plan (PR-121) called for adding a
 *   `wallet_ledgers(riderId, createdAt)` covering index for the
 *   `getLedgerEntries(riderDbId, limit)` hot path in
 *   web/src/server/modules/wallet/wallet.repository.ts:37-41.
 *
 *   Verified 2026-08-04 via web/scripts/inspect-indexes.ts: the index
 *   was already present (declared in schema.prisma:412 as
 *   `@@index([riderId, createdAt])` and applied to the dev DB by a prior
 *   migration). The new migration
 *   20260808000001_wallet_ledger_history_index is a no-op on the current
 *   DB (CONCURRENTLY IF NOT EXISTS) but guarantees the index exists on
 *   any environment where the schema-declared index didn't apply
 *   (e.g. a DB created via `prisma db push`).
 *
 * What this test asserts (pure file inspection — no DB required):
 *   1. The migration file exists at the expected path
 *   2. The migration uses CREATE INDEX CONCURRENTLY IF NOT EXISTS
 *   3. The migration targets the correct (riderId, createdAt) columns
 *   4. schema.prisma declares the same index (single source of truth)
 *   5. The hot-path query (getLedgerEntries) actually filters on
 *      riderId + orders by createdAt DESC (sanity check on the
 *      motivating code, not the index)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../prisma/migrations/20260808000001_wallet_ledger_history_index/migration.sql'
);
const SCHEMA_PATH = resolve(__dirname, '../../prisma/schema.prisma');
const REPOSITORY_PATH = resolve(
  __dirname,
  '../../src/server/modules/wallet/wallet.repository.ts'
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

describe('PR-121: wallet_ledgers(riderId, createdAt) covering index', () => {
  const migration = readFileSync(MIGRATION_PATH, 'utf-8');
  const migrationNoComments = stripSqlComments(migration);
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');
  const repository = readFileSync(REPOSITORY_PATH, 'utf-8');

  it('migration file exists at the expected path', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  it('migration declares CREATE INDEX CONCURRENTLY IF NOT EXISTS', () => {
    expect(migration).toMatch(
      /CREATE INDEX CONCURRENTLY IF NOT EXISTS "wallet_ledgers_riderId_createdAt_idx"/
    );
  });

  it('migration targets the correct (riderId, createdAt) columns', () => {
    expect(migrationNoComments).toContain(
      'ON "wallet_ledgers"("riderId", "createdAt")'
    );
  });

  it('schema.prisma declares the same index (single source of truth)', () => {
    // Find the WalletLedger model and assert it has the @@index([riderId, createdAt])
    // declaration. We look for a unique substring to avoid false matches in
    // other models.
    const modelMatch = schema.match(/model WalletLedger \{[\s\S]*?\n\}/);
    expect(modelMatch).not.toBeNull();
    expect(modelMatch![0]).toContain('@@index([riderId, createdAt])');
  });

  it('hot-path query getLedgerEntries filters on riderId + orders by createdAt', () => {
    // Sanity check on the motivating code. If the query ever changes
    // away from this shape, the (riderId, createdAt) index becomes
    // less useful and the test should be re-thought.
    const fnMatch = repository.match(/getLedgerEntries[\s\S]*?take:\s*limit/);
    expect(fnMatch).not.toBeNull();
    expect(fnMatch![0]).toContain('riderId: riderDbId');
    expect(fnMatch![0]).toContain("orderBy: { createdAt: 'desc' }");
  });
});
