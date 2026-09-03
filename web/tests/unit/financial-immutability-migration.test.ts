import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const MIGRATION_PATH = resolve(
  __dirname,
  '../../prisma/migrations/20260810000001_prevent_transaction_and_ledger_delete/migration.sql'
);
const SCHEMA_PATH = resolve(__dirname, '../../prisma/schema.prisma');

describe('Financial Immutability & DB Delete Triggers', () => {
  it('migration file exists at the expected path', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  it('migration adds BEFORE DELETE trigger for transactions table', () => {
    const migration = readFileSync(MIGRATION_PATH, 'utf-8');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION prevent_transaction_delete()');
    expect(migration).toContain('BEFORE DELETE ON "transactions"');
    expect(migration).toContain('RAISE EXCEPTION');
  });

  it('migration adds BEFORE DELETE trigger for wallet_ledgers table', () => {
    const migration = readFileSync(MIGRATION_PATH, 'utf-8');
    expect(migration).toContain('CREATE OR REPLACE FUNCTION prevent_wallet_ledger_delete()');
    expect(migration).toContain('BEFORE DELETE ON "wallet_ledgers"');
    expect(migration).toContain('RAISE EXCEPTION');
  });

  it('schema.prisma documents immutability and restrict deletion relations', () => {
    const schema = readFileSync(SCHEMA_PATH, 'utf-8');
    expect(schema).toContain('WalletLedger represents the append-only, immutable source of truth');
    expect(schema).toContain('Transaction represents an immutable financial journal entry');
    expect(schema).toContain('onDelete: Restrict');
  });
});
