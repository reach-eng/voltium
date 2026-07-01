/**
 * Vitest global teardown.
 *
 * Runs ONCE after all test files complete. The Prisma client is a
 * module-level singleton (see src/lib/db.ts) — when globalSetup pushes
 * the schema and many test files run against it, connections accumulate
 * in the pool. Without this teardown, the Node process would keep those
 * connections open until the runtime shuts them down, which on some
 * systems causes lingering "FATAL: too many connections" errors on the
 * Postgres side.
 *
 * Replaces the per-file `teardownTestPostgres()` call that previously
 * tried to disconnect the Prisma client after every test file. That
 * approach was wrong because the Prisma client is shared: disconnecting
 * it in one file's afterAll broke all subsequent test files.
 */
export default async function globalTeardown(): Promise<void> {
  // The Prisma client is cached on globalThis (see src/lib/db.ts). We
  // import it dynamically to avoid forcing every test file to load the
  // full Prisma client just to run teardown.
  //
  // The disconnect is wrapped in a try/catch + 5s timeout so that a
  // hung Postgres connection doesn't prevent Vitest from exiting.
  // The Node process will eventually clean up the pool when it exits.
  try {
    const { db } = await import('../src/lib/db');
    const disconnectPromise = db.$disconnect();
    const timeoutPromise = new Promise<void>((resolve) =>
      setTimeout(() => resolve(), 5000),
    );
    await Promise.race([disconnectPromise, timeoutPromise]);
  } catch {
    // Ignore teardown errors — the process is exiting anyway.
  }
}
