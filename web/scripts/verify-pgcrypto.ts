/**
 * Verify pgcrypto functions are callable from the current DB.
 * Used as a one-shot check during PR-122 to confirm the extension
 * is fully functional (not just present in pg_extension).
 */
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  // pgp_sym_encrypt and pgp_sym_decrypt roundtrip
  const enc = await c.query(
    "SELECT pgp_sym_encrypt('hello world', 'key123') AS cipher"
  );
  const cipherHex = enc.rows[0].cipher.toString('hex');
  console.log('pgp_sym_encrypt output (hex):', cipherHex.substring(0, 32) + '...');
  const dec = await c.query(
    "SELECT pgp_sym_decrypt(decode($1, 'hex'), 'key123') AS plain",
    [cipherHex]
  );
  console.log('pgp_sym_decrypt output:', dec.rows[0].plain);
  console.log('pgp_sym_encrypt/decrypt roundtrip:', dec.rows[0].plain === 'hello world' ? 'OK' : 'FAIL');
  // gen_random_bytes
  const rand = await c.query("SELECT gen_random_bytes(8) AS r");
  console.log('gen_random_bytes(8) hex:', rand.rows[0].r.toString('hex'));
  await c.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
