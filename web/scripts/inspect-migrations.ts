import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query(`
    SELECT conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c
    WHERE conrelid = '_prisma_migrations'::regclass
    ORDER BY conname
  `);
  console.log('_prisma_migrations constraints:');
  r.rows.forEach((row) => console.log('  ' + row.conname + ' — ' + row.def));
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
