import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();

  // Current schema
  const cur = await c.query(`SELECT current_schema()`);
  console.log('current_schema:', cur.rows[0]);

  // All rows in wallet_ledgers
  const r1 = await c.query('SELECT COUNT(*)::int AS n FROM wallet_ledgers');
  console.log('wallet_ledgers count:', r1.rows[0]);
  // All rows in wallets
  const r2 = await c.query('SELECT COUNT(*)::int AS n FROM wallets');
  console.log('wallets count:', r2.rows[0]);
  // Find a sample wallet_ledger
  const r3 = await c.query('SELECT id, "walletId", "riderId" FROM wallet_ledgers LIMIT 3');
  console.log('sample wallet_ledgers:', r3.rows);
  // Find the wallet
  const r4 = await c.query('SELECT id, "riderId" FROM wallets LIMIT 3');
  console.log('sample wallets:', r4.rows);
  // Try the failing deleteMany
  console.log('Attempting wallet.deleteMany()...');
  try {
    const r = await c.query('DELETE FROM wallets');
    console.log('  delete OK:', r.rowCount, 'rows');
  } catch (e: any) {
    console.log('  delete ERR:', e.message);
  }

  await c.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
