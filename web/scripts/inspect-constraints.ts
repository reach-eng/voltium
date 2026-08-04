import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
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
  console.log('Found', r.rows.length, 'CHECK constraints in', process.env.DATABASE_URL);
  r.rows.forEach((row) => console.log('  + ' + row.conname + ' on ' + row.tbl));
  await c.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
