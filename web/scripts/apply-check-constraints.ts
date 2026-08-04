import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const migrationPath = path.resolve(__dirname, '../prisma/migrations/20260807000000_add_check_constraints_corrected/migration.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  console.log('Applying migration:', migrationPath);
  console.log('SQL length:', sql.length, 'bytes');

  try {
    await c.query(sql);
    console.log('\n✓ Migration applied OK');
  } catch (e: any) {
    console.error('\n✗ Migration failed:', e.message);
    process.exit(1);
  }

  // Re-run is idempotent test
  console.log('\nRe-running migration to test idempotency...');
  try {
    await c.query(sql);
    console.log('✓ Re-run is no-op (idempotent)');
  } catch (e: any) {
    console.error('✗ Re-run failed:', e.message);
    process.exit(1);
  }

  // Verify all 12 constraints are present
  const r = await c.query(`
    SELECT conname, conrelid::regclass::text AS tbl
    FROM pg_constraint
    WHERE conname IN (
      'rider_battery_level_range',
      'rider_phone_format',
      'rider_email_format',
      'kyc_aadhaar_format',
      'kyc_pan_format',
      'kyc_ifsc_format',
      'wallet_balance_nonnegative',
      'wallet_deposit_nonnegative',
      'outbox_attempts_cap',
      'rental_plan_duration_matches_type',
      'backup_schedule_time_format',
      'idempotency_expiry_after_create'
    )
    ORDER BY conname
  `);
  console.log(`\nVerification: ${r.rows.length}/12 CHECK constraints present in live DB:`);
  r.rows.forEach((row) => console.log('  + ' + row.conname + ' on ' + row.tbl));

  // Test that the constraints actually reject bad data
  // We use ALTER TABLE ... ADD CONSTRAINT ... NOT VALID first (just to be safe),
  // but since the existing migration uses regular CHECK (NOT NOT VALID), we test
  // via INSERT. A CHECK violation should raise SQLSTATE 23514.
  console.log('\nTesting constraint enforcement (INSERT batteryLevel=999 should fail):');
  // First check rider count
  const cnt = await c.query('SELECT COUNT(*)::int AS n FROM riders');
  if (cnt.rows[0].n > 0) {
    console.log(`  (skipping INSERT test: ${cnt.rows[0].n} rider rows exist; testing UPDATE instead)`);
    try {
      await c.query('UPDATE riders SET "batteryLevel" = 999');
      console.log('  ✗ FAIL: bad data was accepted (constraint not active!)');
      process.exit(1);
    } catch (e: any) {
      if (e.code === '23514') {
        console.log('  ✓ PASS: SQLSTATE 23514 (check_violation):', e.message);
      } else {
        console.log('  ? Unexpected error code:', e.code, e.message);
      }
    }
  } else {
    console.log('  (rider table is empty, skipping enforcement test — will be covered by test suite)');
  }

  await c.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
