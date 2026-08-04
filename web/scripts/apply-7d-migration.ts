/**
 * Apply a single migration SQL file to the dev DB.
 * Idempotent: uses CONCURRENTLY IF NOT EXISTS so re-runs are no-ops.
 * Bypasses Prisma migrate so we don't need to mark _prisma_migrations.
 *
 * Splits the file on `;` boundaries and runs each statement independently
 * so CONCURRENTLY (which cannot run inside a transaction block) works.
 */
import { Client } from 'pg';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function splitSqlStatements(sql: string): string[] {
  // Strip comments, then split on `;` at statement boundaries.
  const stripped = sql
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('--');
      return idx === -1 ? line : line.substring(0, idx);
    })
    .join('\n');
  return stripped
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  const migrationPath = process.argv[2];
  if (!migrationPath) {
    console.error('Usage: tsx scripts/apply-7d-migration.ts <migration.sql>');
    process.exit(1);
  }
  const sql = readFileSync(migrationPath, 'utf-8');
  const stmts = splitSqlStatements(sql);
  console.log('Applying:', migrationPath, '(' + stmts.length + ' statements)');
  console.log('Database:', process.env.DATABASE_URL);
  const c = new Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  for (let i = 0; i < stmts.length; i++) {
    const stmt = stmts[i];
    process.stdout.write('  [' + (i + 1) + '/' + stmts.length + '] ');
    try {
      await c.query(stmt);
      console.log('OK');
    } catch (e: any) {
      console.log('FAIL: ' + e.message);
      throw e;
    }
  }
  await c.end();
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
