/**
 * Phase 7D inspect script — check pgcrypto extension and riders schema state
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  const exts = await c.query("SELECT extname FROM pg_extension ORDER BY extname");
  console.log('=== Extensions ===');
  for (const row of exts.rows) console.log('  - ' + row.extname);
  const pgcrypto = exts.rows.some((r) => r.extname === 'pgcrypto');
  console.log('\npgcrypto enabled:', pgcrypto);

  const riders = await c.query(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='riders' ORDER BY ordinal_position"
  );
  console.log('\n=== riders columns ===');
  for (const row of riders.rows) {
    console.log('  - ' + row.column_name + ' (' + row.data_type + (row.is_nullable === 'NO' ? ', NOT NULL' : '') + ')');
  }

  const outbox = await c.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_name='outbox_events' ORDER BY ordinal_position"
  );
  console.log('\n=== outbox_events columns ===');
  for (const row of outbox.rows) {
    console.log('  - ' + row.column_name + ' (' + row.data_type + ')');
  }

  await c.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
