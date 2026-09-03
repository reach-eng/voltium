/**
 * Vitest global setup.
 *
 * Runs ONCE before all test files. Performs expensive setup that should
 * not be repeated per-file:
 *   1. Set NODE_ENV=test so db.ts uses the larger test pool (50 vs 10)
 *   2. Append ?schema=test to DATABASE_URL so test data is isolated
 *      from dev data in a separate Postgres schema
 *   3. Skip prisma db push if SKIP_PRISMA_PUSH=1 (the test schema is
 *      already in sync from a previous run; pushing again is slow on
 *      Windows and can hang the test runner)
 *   4. Verify the test schema actually matches prisma/schema.prisma by
 *      checking a sentinel column ('purgedAt' on "riders"). If the
 *      column is missing, the test schema has drifted out of sync —
 *      fail loudly with a pointer to scripts/sync-test-schema.sh
 *      instead of letting tests run against a stale schema (where the
 *      failure would be a confusing "column does not exist" deep in a
 *      test, or worse, silent misbehavior).
 *
 * Replaces the per-file `setupTestPostgres()` call that was previously
 * invoked in 43 test files. That per-file approach caused two problems:
 *   1. prisma db push ran 43 times, occasionally failing on engine lock
 *   2. The shared Prisma connection pool (size 50) filled up across
 *      files and caused "Can't reach database server" errors
 */
export default async function globalSetup(): Promise<void> {
  (process.env as any).NODE_ENV = 'test';

  if (process.env.DATABASE_URL) {
    if (!process.env.DATABASE_URL.includes('schema=')) {
      process.env.DATABASE_URL +=
        process.env.DATABASE_URL.includes('?') ? '&schema=test' : '?schema=test';
    }
  }

  // Skip the prisma db push if SKIP_PRISMA_PUSH=1. The test schema is
  // managed by a separate migration script (scripts/sync-test-schema.sh)
  // that runs once per CI build. This avoids the 2-3 minute prisma db
  // push on every `npm test` invocation.
  if (process.env.SKIP_PRISMA_PUSH === '1') {
    console.log('[global-setup] SKIP_PRISMA_PUSH=1, skipping prisma db push');
  } else {
    // Push the Prisma schema to the test DB. This is a one-time cost
    // amortized across all test files. If it fails (e.g. another CI
    // process is running it concurrently), the schema may still be in
    // sync — the sentinel check below decides whether that is actually
    // true or whether the failure hid real schema drift.
    const { execSync } = await import('node:child_process');
    try {
      execSync('npx prisma db push --accept-data-loss --skip-generate', {
        stdio: 'pipe',
        timeout: 60_000,
      });
    } catch (err) {
      console.warn(
        '[global-setup] prisma db push failed (verifying schema via sentinel check):',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  // Sentinel check — runs on BOTH the push path and the
  // SKIP_PRISMA_PUSH=1 path. This is the loud schema-drift gate: the
  // test schema must contain the columns prisma/schema.prisma declares.
  // If 'purgedAt' is missing, the schema is stale (e.g. the sync script
  // was never run, or db push failed for a non-concurrency reason).
  await verifyPurgedAtSentinel();
}

const SENTINEL_SCHEMA = 'test';
const SENTINEL_TABLE = 'riders';
const SENTINEL_COLUMN = 'purgedAt';

/**
 * Queries information_schema for the 'purgedAt' column on the "riders"
 * table of the ?schema=test database and throws a clear, actionable
 * error when it is missing.
 *
 * Connection failures are NOT treated as drift — a database that cannot
 * be reached will produce its own test failures with better context. We
 * warn and continue in that case.
 */
async function verifyPurgedAtSentinel(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn('[global-setup] DATABASE_URL not set — skipping sentinel check');
    return;
  }

  const { Client } = await import('pg');
  const client = new Client({ connectionString: url });

  try {
    await client.connect();
    const { rows } = await client.query(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = $2
          AND column_name = $3`,
      [SENTINEL_SCHEMA, SENTINEL_TABLE, SENTINEL_COLUMN],
    );

    if (rows.length === 0) {
      throw new Error(
        [
          '[global-setup] FATAL: test schema drift detected.',
          '',
          `The '${SENTINEL_COLUMN}' column is missing from table '${SENTINEL_TABLE}' ` +
            `in schema '${SENTINEL_SCHEMA}' — the test database does not match ` +
            'prisma/schema.prisma. This usually means the test schema was never ' +
            'synced after a schema change — a plain `prisma db push` is not enough: ' +
            'it creates timestamp(3) columns and skips the datetime->timestamptz ' +
            'conversion the sync script applies.',
          '',
          'Fix by running the schema sync script from the web/ directory:',
          '    bash scripts/sync-test-schema.sh',
          '',
          'In CI this runs in the "Tests" job before vitest. If the sentinel column',
          'was intentionally removed from the Rider model, update the sentinel',
          `check in web/tests/global-setup.ts (SENTINEL_* constants above).`,
        ].join('\n'),
      );
    }
  } catch (err) {
    // Distinguish drift (missing column — fail loudly) from a DB that
    // cannot be reached (warn and let the tests surface their own error).
    if (err instanceof Error && err.message.includes('schema drift detected')) {
      throw err;
    }
    console.warn(
      '[global-setup] could not verify sentinel column (DB unreachable):',
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    await client.end().catch(() => {
      // Ignore close errors — the process is about to run tests anyway.
    });
  }
}
