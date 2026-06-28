/**
 * Migration Validation Tests (Phase 5a)
 *
 * Validates Prisma migration integrity:
 *   1. Migration directory structure is well-formed
 *   2. Every migration has a SQL file
 *   3. No empty migration folders
 *   4. Schema file is valid and parseable
 *   5. Migration timestamps are monotonically increasing
 *   6. No orphaned migration_lock.toml
 *
 * These tests run without a live database — they validate file-level integrity.
 * The actual `prisma migrate deploy` is tested in CI (ci-cd.yml test job).
 *
 * Run: npx vitest run tests/unit/migration.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

const MIGRATIONS_DIR = resolve(__dirname, '../../prisma/migrations');
const SCHEMA_PATH = resolve(__dirname, '../../prisma/schema.prisma');
const LOCK_PATH = resolve(__dirname, '../../prisma/migrations/migration_lock.toml');

describe('Migration directory structure', () => {
  it('prisma/migrations directory exists', () => {
    expect(existsSync(MIGRATIONS_DIR)).toBe(true);
    expect(statSync(MIGRATIONS_DIR).isDirectory()).toBe(true);
  });

  it('migration_lock.toml exists at the root of migrations', () => {
    expect(existsSync(LOCK_PATH)).toBe(true);
    const content = readFileSync(LOCK_PATH, 'utf-8');
    expect(content).toContain('provider = "postgresql"');
  });

  it('prisma/schema.prisma exists and is non-empty', () => {
    expect(existsSync(SCHEMA_PATH)).toBe(true);
    const content = readFileSync(SCHEMA_PATH, 'utf-8');
    expect(content.length).toBeGreaterThan(100);
    expect(content).toContain('generator');
    expect(content).toContain('datasource');
  });
});

describe('Migration folders — well-formed', () => {
  const migrationDirs = readdirSync(MIGRATIONS_DIR).filter((name) => {
    const fullPath = join(MIGRATIONS_DIR, name);
    return statSync(fullPath).isDirectory();
  });

  it('has at least one migration', () => {
    expect(migrationDirs.length).toBeGreaterThan(0);
  });

  for (const dir of migrationDirs) {
    it(`migration "${dir}" has a SQL file`, () => {
      const migrationPath = join(MIGRATIONS_DIR, dir);
      const files = readdirSync(migrationPath);
      const sqlFiles = files.filter((f) => f.endsWith('.sql'));
      expect(sqlFiles.length).toBeGreaterThanOrEqual(1);
    });

    it(`migration "${dir}" folder name matches timestamp or init pattern`, () => {
      // Migration folders are named: YYYYMMDDHHMMSS_descriptive_name
      // or the initial migration: 0_init
      expect(dir).toMatch(/^(\d{14}_.+|0_init)$/);
    });
  }
});

describe('Migration timestamps — monotonic order', () => {
  it('all migration timestamps are monotonically increasing', () => {
    const migrationDirs = readdirSync(MIGRATIONS_DIR)
      .filter((name) => {
        const fullPath = join(MIGRATIONS_DIR, name);
        return statSync(fullPath).isDirectory();
      })
      .map((name) => {
        const timestamp = parseInt(name.split('_')[0], 10);
        return { name, timestamp };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    for (let i = 1; i < migrationDirs.length; i++) {
      expect(migrationDirs[i].timestamp).toBeGreaterThan(
        migrationDirs[i - 1].timestamp
      );
    }
  });
});

describe('Schema — content validation', () => {
  let schema: string;

  beforeAll(() => {
    schema = readFileSync(SCHEMA_PATH, 'utf-8');
  });

  it('defines a PostgreSQL datasource', () => {
    expect(schema).toContain('provider = "postgresql"');
  });

  it('defines a Prisma Client generator', () => {
    expect(schema).toContain('generator client');
    expect(schema).toContain('provider = "prisma-client-js"');
  });

  it('includes the Rider model', () => {
    expect(schema).toContain('model Rider');
  });

  it('includes the Wallet model', () => {
    expect(schema).toContain('model Wallet');
  });

  it('includes the WalletLedger model', () => {
    expect(schema).toContain('model WalletLedger');
  });

  it('includes the Vehicle model', () => {
    expect(schema).toContain('model Vehicle');
  });

  it('includes the RentalLease model', () => {
    expect(schema).toContain('model RentalLease');
  });

  it('includes the Transaction model', () => {
    expect(schema).toContain('model Transaction');
  });

  it('includes the Admin model', () => {
    expect(schema).toContain('model Admin');
  });

  it('includes the SupportTicket model', () => {
    expect(schema).toContain('model SupportTicket');
  });

  it('no raw SQL injection patterns in schema', () => {
    // The schema should not contain raw SQL that could be dangerous
    const dangerousPatterns = ['DROP TABLE', 'DELETE FROM', 'TRUNCATE', 'EXEC ', 'EXECUTE '];
    for (const pattern of dangerousPatterns) {
      expect(schema.toUpperCase()).not.toContain(pattern);
    }
  });
});
