/**
 * PR-96 (DB-M-1) — Migration history bootstrap script
 *
 * The current dev DB has 34 Prisma migrations in disk but only 1 row in
 * `_prisma_migrations` (the 0_init baseline). The other 33 were applied
 * via `prisma db push` rather than `prisma migrate deploy`.
 *
 * For the 2026-08-06 staging soak, the gated drop migrations
 * (20260806000000_drop_admin_legacy_permissions,
 *  20260806010000_drop_rider_legacy_string_columns,
 *  20260806020000_drop_rider_legacy_lifecycle_status)
 * must be applied via `migrate deploy` in staging. If the previous
 * migrations aren't marked as applied, deploy will try to re-apply them
 * and fail (DDL is mostly idempotent but some ALTER statements are not).
 *
 * This script:
 *   1. Marks all migrations BEFORE 20260806000000 as applied (they ran)
 *   2. Marks the 2 new Phase 7A migrations as applied (already verified
 *      to run cleanly on the dev DB)
 *   3. Leaves 20260806000000/20260806010000/20260806020000 as NOT applied
 *      so they run on staging-soak when the gate is lifted
 *
 * Idempotent: running twice produces the same final state.
 *
 * Usage:
 *   $ npx tsx scripts/resolve-migration-history.ts
 */

import { Client } from 'pg';
import { readdirSync } from 'fs';
import { resolve } from 'path';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MIG_DIR = resolve(__dirname, '../prisma/migrations');

async function main() {
  console.log('Migration history bootstrap — Phase 7A PR-96');
  console.log('Database:', process.env.DATABASE_URL);

  const dirMigs = readdirSync(MIG_DIR)
    .filter((d) => /^\d{14}_/.test(d))
    .sort();
  console.log('Migrations in dir:', dirMigs.length);

  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // Find what's already in _prisma_migrations
  const before = await c.query('SELECT migration_name FROM _prisma_migrations');
  const alreadyApplied = new Set(before.rows.map((r) => r.migration_name));
  console.log('Already in _prisma_migrations:', alreadyApplied.size);

  // Determine which migrations to mark as applied:
  //   - All migrations BEFORE 20260806000000 (the first gated drop)
  //   - 2 new Phase 7A migrations (20260807000000, 20260807000001)
  //   - DO NOT mark 20260806000000/20260806010000/20260806020000 as applied
  const GATED_DROPS = new Set([
    '20260806000000_drop_admin_legacy_permissions',
    '20260806010000_drop_rider_legacy_string_columns',
    '20260806020000_drop_rider_legacy_lifecycle_status',
  ]);
  const GATE_PREFIX = '20260806'; // First gated drop

  const toMark = dirMigs.filter((m) => {
    if (alreadyApplied.has(m)) return false;
    if (GATED_DROPS.has(m)) return false;
    // Include all pre-gate + 2 new 7A migrations
    return m < GATE_PREFIX || m.startsWith('20260807');
  });

  console.log('\nMarking as applied:', toMark.length, 'migrations');
  toMark.forEach((m) => console.log('  + ' + m));

  if (toMark.length === 0) {
    console.log('\n✓ Nothing to do — already in sync.');
    await c.end();
    return;
  }

  await c.query('BEGIN');
  try {
    for (const m of toMark) {
      // Check if already applied (defensive — the alreadyApplied set above
      // also filters, but be safe inside the transaction)
      const exists = await c.query(
        'SELECT 1 FROM _prisma_migrations WHERE migration_name = $1',
        [m]
      );
      if (exists.rows.length > 0) continue;

      const checksum = 'phase7a-pr96-' + m;
      await c.query(
        `INSERT INTO _prisma_migrations
         (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES (gen_random_uuid()::text, $1, NOW(), $2, NULL, NULL, NOW(), 1)`,
        [checksum, m]
      );
    }
    await c.query('COMMIT');
  } catch (e: any) {
    await c.query('ROLLBACK');
    console.error('Failed:', e.message);
    process.exit(1);
  }

  // Verify
  const after = await c.query('SELECT migration_name FROM _prisma_migrations ORDER BY migration_name');
  const appliedSet = new Set(after.rows.map((r) => r.migration_name));
  const stillMissing = dirMigs.filter((m) => !appliedSet.has(m));
  console.log('\nFinal state: ' + after.rows.length + ' rows in _prisma_migrations');
  if (stillMissing.length > 0) {
    console.log('Still missing (gated drops, not yet applied):');
    stillMissing.forEach((m) => console.log('  - ' + m));
  } else {
    console.log('All migrations marked as applied.');
  }

  await c.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
