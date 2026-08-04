/**
 * Phase 7D inspect script — list all pg_indexes on hot tables
 * Used to confirm missing indexes before adding migrations.
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const HOT_TABLES = [
  'outbox_events',
  'rental_leases',
  'rental_plans',
  'wallet_ledgers',
  'wallets',
  'transactions',
  'riders',
  'kyc_profiles',
  'audit_logs',
  'support_tickets',
  'backup_jobs',
  'backup_schedules',
  'notifications',
];

async function main() {
  console.log('Database:', process.env.DATABASE_URL);
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  for (const t of HOT_TABLES) {
    const r = await c.query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname='public' AND tablename=$1 ORDER BY indexname",
      [t]
    );
    console.log('\n=== ' + t + ' ===');
    if (r.rows.length === 0) {
      console.log('  (no indexes / table missing)');
      continue;
    }
    for (const row of r.rows) {
      console.log('  - ' + row.indexname);
    }
  }
  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
