import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const sql = fs.readFileSync(
    path.resolve(__dirname, '../prisma/migrations/20260807000001_idempotent_lifecycle_stage_backfill/migration.sql'),
    'utf8'
  );
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  console.log('Applying 20260807000001_idempotent_lifecycle_stage_backfill...');
  try {
    await c.query(sql);
    console.log('✓ Migration applied');
  } catch (e: any) {
    console.error('✗ Failed:', e.message);
    process.exit(1);
  }

  // Re-run for idempotency
  console.log('Re-running for idempotency check...');
  try {
    await c.query(sql);
    console.log('✓ Re-run is no-op');
  } catch (e: any) {
    console.error('✗ Re-run failed:', e.message);
    process.exit(1);
  }

  // Verify lifecycleStage coverage
  const r = await c.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT("lifecycleStage")::int AS with_stage
    FROM riders
  `);
  console.log('\nRiders lifecycleStage coverage:', r.rows[0]);

  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
