import { execSync } from 'child_process';
import { db } from '../../src/lib/db';
import { logger } from '../../src/lib/logger';

export const testDb = db;

// Flag to ensure setupTestPostgres only runs the prisma db push once
// across all test files in the same Vitest run. Running it per-file is
// expensive and can fail intermittently when concurrent processes try
// to acquire the same Prisma engine lock.
let setupDone = false;

export async function setupTestPostgres() {
  logger.info('Using local Postgres with test schema... DATABASE_URL: ' + process.env.DATABASE_URL);

  if (!setupDone) {
    logger.info('Pushing Prisma schema to test DB...');
    try {
      execSync('npx prisma db push --accept-data-loss --skip-generate', {
        env: { ...process.env },
        stdio: 'pipe',
        timeout: 60_000,
      });
    } catch (err) {
      // If the push fails because another test file is doing it
      // concurrently, the schema is likely already in sync. Continue.
      logger.warn('prisma db push failed (schema may already be in sync):', err);
    }
    setupDone = true;
  }

  return testDb;
}

export async function teardownTestPostgres() {
  // Intentionally do NOT call $disconnect() here. The Prisma client is a
  // module-level singleton (see src/lib/db.ts) and is shared across all
  // test files. Disconnecting it in one file's afterAll would break all
  // subsequent test files. The client is disconnected automatically when
  // the Node process exits.
}
