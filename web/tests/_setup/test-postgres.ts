import { db } from '../../src/lib/db';
import { logger } from '../../src/lib/logger';

export const testDb = db;

/**
 * @deprecated Schema push and pool setup are now handled by the Vitest
 * global setup at tests/global-setup.ts. This shim remains for
 * backward compatibility with test files that still import it; it is
 * a no-op. Will be removed once all test files are migrated.
 */
export async function setupTestPostgres(): Promise<typeof db> {
  logger.info('[test-postgres] setupTestPostgres is a no-op (handled by global-setup)');
  return testDb;
}

/**
 * @deprecated Pool teardown is now handled by the Vitest global
 * teardown at tests/global-teardown.ts. This shim remains for backward
 * compatibility. Will be removed once all test files are migrated.
 */
export async function teardownTestPostgres(): Promise<void> {
  // No-op: see globalTeardown for the real teardown logic.
}
