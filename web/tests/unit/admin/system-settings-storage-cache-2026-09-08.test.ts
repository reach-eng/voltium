import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P1-4 (system-settings section audit, 2026-09-08) — contract tests
 * for the storage-cache + restart-hint wiring.
 *
 *   1. The PUT route calls `StoragePathBuilder.invalidateCache()` when
 *      the key is one of the 3 storage roots. (Verified by static
 *      grep — the call is wired in the route file.)
 *   2. The system-settings route returns a `requiresRestart` field on
 *      every editable row. (Verified by static grep on the GET.)
 *   3. The `/api/ready` route resolves `uploadsRoot` via
 *      `StoragePathBuilder.getUploadsRoot()` (DB-first), not the
 *      env-only `process.env.LOCAL_STORAGE_ROOT || join(cwd, ...)`
 *      fallback that previously left monitoring and runtime on
 *      different roots.
 *   4. The `/api/health/storage` route returns a `sources` object
 *      tagging each path with `DB` / `env` / `default`.
 *   5. The `requiresRestart` column exists on `SystemSetting` and
 *      is backfilled to `true` for the 3 storage roots by the
 *      migration.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..');
const ROUTE_FILE = join(REPO_ROOT, 'src', 'app', 'api', 'admin', 'system-settings', 'route.ts');
const READY_FILE = join(REPO_ROOT, 'src', 'app', 'api', 'ready', 'route.ts');
const HEALTH_STORAGE_FILE = join(REPO_ROOT, 'src', 'app', 'api', 'health', 'storage', 'route.ts');
const SCHEMA_FILE = join(REPO_ROOT, 'prisma', 'schema.prisma');
const MIGRATION_DIR = join(
  REPO_ROOT,
  'prisma',
  'migrations',
  '20260910075926_system_settings_requires_restart'
);
const MIGRATION_FILE = join(MIGRATION_DIR, 'migration.sql');

function stripAllDocComments(text: string): string {
  return text.replace(/\/\*\*[\s\S]*?\*\//g, '');
}

describe('P1-4: storage root cache invalidation on PUT', () => {
  it('the route imports StoragePathBuilder', () => {
    const text = readFileSync(ROUTE_FILE, 'utf8');
    expect(text).toMatch(/import\s*\{[^}]*StoragePathBuilder[^}]*\}\s*from\s*['"]@\/lib\/storage-path-builder['"]/);
  });

  it('the PUT calls StoragePathBuilder.invalidateCache() for the 3 storage root keys', () => {
    const text = stripAllDocComments(readFileSync(ROUTE_FILE, 'utf8'));
    expect(text).toMatch(/StoragePathBuilder\.invalidateCache\s*\(\s*\)/);
    // All 3 storage keys appear in the conditional that calls
    // invalidateCache. The audit found that editing these was a
    // silent no-op until a process restart; this PR closes the gap
    // for the LOCAL process.
    expect(text).toMatch(/LOCAL_STORAGE_ROOT/);
    expect(text).toMatch(/BACKUP_ROOT/);
    expect(text).toMatch(/BACKUP_SECONDARY_ROOT/);
  });
});

describe('P1-4: requiresRestart on the GET response', () => {
  it('the route\'s editable type includes requiresRestart', () => {
    const text = readFileSync(ROUTE_FILE, 'utf8');
    expect(text).toMatch(/requiresRestart\s*:\s*boolean/);
  });

  it('the GET maps requiresRestart from the DB row to the response', () => {
    const text = stripAllDocComments(readFileSync(ROUTE_FILE, 'utf8'));
    expect(text).toMatch(/requiresRestart:\s*s\.requiresRestart/);
  });
});

describe('P1-4: /api/ready uses DB-first storage resolution', () => {
  it('the ready route imports StoragePathBuilder', () => {
    const text = readFileSync(READY_FILE, 'utf8');
    expect(text).toMatch(/StoragePathBuilder/);
  });

  it('the ready route resolves uploadsRoot via the builder (not env-only)', () => {
    const text = stripAllDocComments(readFileSync(READY_FILE, 'utf8'));
    // Was: `process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads')`
    // Now: `await StoragePathBuilder.getUploadsRoot()`
    expect(text).toMatch(/StoragePathBuilder\.getUploadsRoot\s*\(\s*\)/);
    // And the env-only fallback is gone.
    expect(text).not.toMatch(/process\.env\.LOCAL_STORAGE_ROOT\s*\|\|/);
  });
});

describe('P1-4: /api/health/storage surfaces a sources object', () => {
  it('the storage health route returns a `sources` field tagging each path with its source', () => {
    const text = stripAllDocComments(readFileSync(HEALTH_STORAGE_FILE, 'utf8'));
    expect(text).toMatch(/sources\s*:\s*\{/);
    expect(text).toMatch(/uploadsRoot/);
    expect(text).toMatch(/backupRoot/);
    expect(text).toMatch(/secondaryBackupRoot/);
  });
});

describe('P1-4: schema and migration', () => {
  it('the SystemSetting model has a requiresRestart column defaulting to false', () => {
    const text = readFileSync(SCHEMA_FILE, 'utf8');
    expect(text).toMatch(/requiresRestart\s+Boolean\s+@default\(false\)/);
  });

  it('the migration adds the column and backfills the 3 storage roots to true', () => {
    const migration = readFileSync(MIGRATION_FILE, 'utf8');
    expect(migration).toMatch(/ADD COLUMN "requiresRestart"/);
    expect(migration).toMatch(/UPDATE "system_settings"/);
    expect(migration).toMatch(/LOCAL_STORAGE_ROOT/);
    expect(migration).toMatch(/BACKUP_ROOT/);
    expect(migration).toMatch(/BACKUP_SECONDARY_ROOT/);
  });
});
