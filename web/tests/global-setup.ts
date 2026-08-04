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
 *
 * Replaces the per-file `setupTestPostgres()` call that was previously
 * invoked in 43 test files. That per-file approach caused two problems:
 *   1. prisma db push ran 43 times, occasionally failing on engine lock
 *   2. The shared Prisma connection pool (size 50) filled up across
 *      files and caused "Can't reach database server" errors
 */
export default async function globalSetup(): Promise<void> {
  process.env.NODE_ENV = 'test';

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
    return;
  }

  // Push the Prisma schema to the test DB. This is a one-time cost
  // amortized across all test files. If it fails (e.g. another CI
  // process is running it concurrently), the schema is likely already
  // in sync — log and continue.
  const { execSync } = await import('node:child_process');
  try {
    execSync('npx prisma db push --accept-data-loss --skip-generate', {
      stdio: 'pipe',
      timeout: 60_000,
    });
  } catch (err) {
    console.warn(
      '[global-setup] prisma db push failed (schema may already be in sync):',
      err instanceof Error ? err.message : String(err),
    );
  }
}
