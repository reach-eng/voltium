import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // 1. CHECK constraints (PR-97 scope)
  const r1 = await c.query(`
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
      'outbox_attempts_cap',
      'rental_plan_duration_matches_type'
    )
    ORDER BY conname
  `);
  console.log('CHECK constraints (PR-97):', r1.rows.length, 'found');
  r1.rows.forEach((row) => console.log('  +', row.conname, 'on', row.tbl));

  // 2. Riders columns
  const r2 = await c.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'riders'
      AND column_name IN ('lifecycleStage', 'lifecycleStatus', 'pickupHub', 'pickupHubId', 'currentPlan', 'currentPlanId', 'teamLeader', 'teamLeaderId', 'phone', 'email', 'batteryLevel')
    ORDER BY column_name
  `);
  console.log('\nriders columns:');
  r2.rows.forEach((row) => console.log('  ' + row.column_name + ' (' + row.data_type + ')'));

  // 3. Sample rider row
  const r3 = await c.query('SELECT id, phone, "lifecycleStatus", "lifecycleStage", "pickupHub", "pickupHubId" FROM riders LIMIT 3');
  console.log('\nsample riders:', r3.rows);

  // 4. Wallet column types (snake_case)
  const r4 = await c.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'wallets'
      AND column_name IN ('balanceInPaise', 'securityDepositInPaise', 'riderId')
    ORDER BY column_name
  `);
  console.log('\nwallets columns:');
  r4.rows.forEach((row) => console.log('  ' + row.column_name + ' (' + row.data_type + ')'));

  // 5. OutboxEvent columns
  const r5 = await c.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'outbox_events'
      AND column_name IN ('attempts', 'maxAttempts')
    ORDER BY column_name
  `);
  console.log('\noutbox_events columns:');
  r5.rows.forEach((row) => console.log('  ' + row.column_name + ' (' + row.data_type + ')'));

  // 6. Migration table state
  const r6 = await c.query(`
    SELECT migration_name, finished_at IS NOT NULL AS finished
    FROM _prisma_migrations
    ORDER BY started_at DESC
    LIMIT 15
  `);
  console.log('\nprisma migration history (last 15):');
  r6.rows.forEach((row) => console.log('  ' + (row.finished ? '✓' : '✗') + ' ' + row.migration_name));

  await c.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
