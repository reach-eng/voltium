/**
 * Per-file Postgres schema isolation.
 *
 * TEST-STRATEGY-AUDIT T-P0-2 (2026-08-08): the default `tests/_setup/test-postgres.ts`
 * helper runs all test files against a single shared schema. `prisma db push
 * --accept-data-loss` in one file's `beforeAll` wipes the data the previous
 * file just created, and the shared connection pool fills up. Two tests
 * (`money/transaction.repository.test.ts:41` and `money/deposit-ledger.service.test.ts:58`)
 * were silently disabled with `it.skip` because of this.
 *
 * The fix: each test file that needs schema isolation calls
 * `usePerFileSchema()` in `beforeAll`, which:
 *   1. Generates a unique schema name from the test file's basename
 *      (`vitest_worker_id_$filename`).
 *   2. Sets `process.env.DATABASE_URL` to the unique schema so any
 *      `new PrismaClient()` in the test code uses the isolated DB.
 *   3. Runs `prisma db push` to materialize the schema.
 *   4. Drops the schema in `afterAll`.
 *
 * The schema is shared across all `describe` blocks in the file (since
 * they all execute in the same worker) but isolated from other test files.
 *
 * Usage:
 *
 *   import { usePerFileSchema, useIsolatedDb } from '../_setup/per-file-schema';
 *
 *   describe('transactionRepository', () => {
 *     usePerFileSchema(__filename);  // wraps beforeAll + afterAll
 *
 *     it('...', async () => {
 *       const db = useIsolatedDb();
 *       await db.rider.create({ data: { ... } });
 *     });
 *   });
 */

import { afterAll, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as path from 'path';

const BASE_DB_URL =
  process.env.DATABASE_URL ||
  'postgresql://voltium_test:voltium_test@localhost:5432/voltium_test';

function baseUrl(): string {
  return BASE_DB_URL.replace(/[?&]schema=[^&]+/, '');
}

function deriveSchemaName(filename: string, workerId: number): string {
  // Strip path, extension, dots that would confuse Postgres identifiers.
  const base = path
    .basename(filename)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .toLowerCase();
  return `t_${workerId}_${base}`.slice(0, 63); // Postgres identifier limit
}

function schemaUrl(schemaName: string): string {
  // The separator must be derived from baseUrl(), NOT BASE_DB_URL: the
  // global-setup appends `?schema=test` to DATABASE_URL, and BASE_DB_URL
  // therefore always contains a `?` — using it for the separator produced
  // `.../voltium_dev&schema=t_0_...` (missing `?`), which Prisma parsed as
  // a literal database name `voltium_dev&schema=...` and tried to CREATE
  // DATABASE (permission denied). baseUrl() has the query stripped, so its
  // `?`/`&` decision is the correct one.
  const sep = baseUrl().includes('?') ? '&' : '?';
  return baseUrl() + `${sep}schema=${schemaName}`;
}

function pushMigrations(schemaName: string): void {
  const prismaCli = path.join(
    __dirname,
    '..',
    '..',
    'node_modules',
    'prisma',
    'build',
    'index.js',
  );
  execSync(
    `node "${prismaCli}" db push --skip-generate --accept-data-loss`,
    {
      cwd: path.join(__dirname, '..', '..'),
      stdio: 'pipe',
      timeout: 30_000,
      env: { ...process.env, DATABASE_URL: schemaUrl(schemaName) },
    },
  );
}

async function execSchema(sql: string, schemaName: string): Promise<void> {
  const temp = new PrismaClient({ datasources: { db: { url: baseUrl() } } });
  try {
    await temp.$executeRawUnsafe(sql.replace('__SCHEMA__', schemaName));
  } finally {
    await temp.$disconnect();
  }
}

/**
 * Wrap `beforeAll` + `afterAll` to set up a per-file schema. Pass the
 * current test file's `__filename` so the schema name is unique to the
 * file. The schema is shared across `describe` blocks in the same
 * file but isolated from other test files in the same worker.
 */
export function usePerFileSchema(filename: string): void {
  const workerId = (process as unknown as { vitest?: { workerId?: number } })
    .vitest?.workerId ?? 0;
  const schemaName = deriveSchemaName(filename, workerId);

  beforeAll(
    async () => {
      await execSchema(
        'CREATE SCHEMA IF NOT EXISTS "__SCHEMA__"',
        schemaName,
      );
      pushMigrations(schemaName);
      // Override DATABASE_URL so any PrismaClient instantiated in the
      // test code targets the per-file schema.
      process.env.DATABASE_URL = schemaUrl(schemaName);
    },
    60_000,
  );

  afterAll(
    async () => {
      try {
        await execSchema('DROP SCHEMA IF EXISTS "__SCHEMA__" CASCADE', schemaName);
      } catch (err) {
        // Best-effort: a stale schema is not a test failure.
        console.warn(`[per-file-schema] failed to drop ${schemaName}:`, err);
      }
    },
    30_000,
  );
}

/**
 * Get a PrismaClient for the current test. Use this inside `it` blocks
 * when the per-file schema is active. The client connects to whatever
 * `DATABASE_URL` was set by `usePerFileSchema` in `beforeAll`.
 */
export function useIsolatedDb(): PrismaClient {
  return new PrismaClient();
}

/**
 * For tests that want to share a single PrismaClient across the file
 * (cheaper than one-per-test), call this in `beforeAll` and store the
 * client in a module-level variable. Remember to `$disconnect()` in
 * `afterAll`.
 */
export function createIsolatedDb(): PrismaClient {
  return new PrismaClient();
}
