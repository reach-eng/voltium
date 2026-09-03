import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const SCHEMA_PATH = resolve(__dirname, '../../prisma/schema.prisma');
const TRANSITION_MIGRATION_PATH = resolve(
  __dirname,
  '../../prisma/migrations/20260810000002_add_state_machine_transition_guards/migration.sql'
);
const DOC_PATH = resolve(__dirname, '../../../docs/DATABASE_LIFECYCLE_AND_CONSTRAINTS.md');

describe('Database Architecture: Relations, Transition Guards & Soft-Delete Standards', () => {
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');

  it('all relation definitions with fields: explicitly define onDelete policy', () => {
    const relationLines = schema
      .split('\n')
      .filter((line) => line.includes('@relation(') && line.includes('fields:'));

    expect(relationLines.length).toBeGreaterThan(15);
    for (const line of relationLines) {
      expect(line).toMatch(/onDelete:\s*(Cascade|SetNull|Restrict)/);
    }
  });

  it('state machine transition migration exists and defines status triggers', () => {
    expect(existsSync(TRANSITION_MIGRATION_PATH)).toBe(true);
    const migration = readFileSync(TRANSITION_MIGRATION_PATH, 'utf-8');

    expect(migration).toContain('guard_transaction_status_transitions()');
    expect(migration).toContain('BEFORE UPDATE OF "status" ON "transactions"');

    expect(migration).toContain('guard_deposit_status_transitions()');
    expect(migration).toContain('BEFORE UPDATE OF "status" ON "deposit_records"');

    expect(migration).toContain('guard_rental_lease_status_transitions()');
    expect(migration).toContain('BEFORE UPDATE OF "status" ON "rental_leases"');
  });

  it('soft-deletable domain models define deletedAt field', () => {
    const softDeletableModels = [
      'model Rider',
      'model Vehicle',
      'model Hub',
      'model RentalPlan',
      'model Shift',
      'model SupportTicket',
      'model TeamLeader',
    ];

    for (const modelHeader of softDeletableModels) {
      const modelBlock = schema.split(modelHeader)[1]?.split('}')[0];
      expect(modelBlock, `Expected ${modelHeader} to define deletedAt`).toBeDefined();
      expect(modelBlock).toContain('deletedAt');
    }
  });

  it('architectural design documentation exists', () => {
    expect(existsSync(DOC_PATH)).toBe(true);
    const doc = readFileSync(DOC_PATH, 'utf-8');
    expect(doc).toContain('DB-015');
    expect(doc).toContain('DB-016');
    expect(doc).toContain('DB-017');
  });
});
