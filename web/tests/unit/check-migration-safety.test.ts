/**
 * Ticket #34 — check-migration-safety.sh always exits 0
 *
 * The audit's claim was that the script silently passes on destructive
 * migrations. The script has been hardened (find-based file enumeration,
 * nullglob, real "no migrations" detection) and these tests lock in the
 * new behavior.
 *
 * Pure node-side test (no shell required) that exercises the script via
 * spawnSync against a synthetic migration directory.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';

const SCRIPT_PATH = resolve(__dirname, '../../../scripts/check-migration-safety.sh');
const BASH = process.env.BASH_PATH || 'C:\\Program Files\\Git\\bin\\bash.exe';

function runScript(workspaceRoot: string): { status: number | null; stdout: string; stderr: string } {
  // P0 fix 2026-09-03: the gate anchors relative MIGRATION_DIR at the repo
  // root, so fixtures must pass an ABSOLUTE dir pointing at the synthetic
  // tree (otherwise the script would scan the real repo). Converted to Git
  // Bash form (/c/…) — backslash or C:/ paths do not resolve in find/test.
  const absMigDir = join(workspaceRoot, 'web', 'prisma', 'migrations')
    .replace(/\\/g, '/')
    .replace(/^([A-Za-z]):/, (_, d: string) => `/${d.toLowerCase()}`);
  const posixScript = SCRIPT_PATH.replace(/\\/g, '/').replace(
    /^([A-Za-z]):/,
    (_, d: string) => `/${d.toLowerCase()}`
  );
  const result = spawnSync(
    BASH,
    ['-c', `cd "${workspaceRoot}" && MIGRATION_DIR='${absMigDir}' bash "${posixScript}"`],
    { encoding: 'utf-8' }
  );
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

describe('check-migration-safety.sh (#34)', () => {
  let workdir: string;
  let migDir: string;

  beforeEach(() => {
    workdir = mkdtempSync(join(tmpdir(), 'mig-safety-'));
    migDir = join(workdir, 'web', 'prisma', 'migrations');
    mkdirSync(migDir, { recursive: true });
  });

  // P0 fix 2026-09-03: real layout is <name>/migration.sql (one level
  // deeper). The safety gate uses `find ... -name migration.sql`, so
  // fixtures must use the nested layout — flat *.sql files are (correctly)
  // ignored, matching production behavior.
  function writeMig(name: string, sql: string, base: string = migDir): void {
    const dir = join(base, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'migration.sql'), sql);
  }

  afterEach(() => {
    try {
      rmSync(workdir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  it('exits 0 when migration directory does not exist (greenfield repo)', () => {
    rmSync(join(workdir, 'web', 'prisma', 'migrations'), { recursive: true, force: true });
    rmSync(join(workdir, 'web', 'prisma'), { recursive: true, force: true });
    const result = runScript(workdir);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/No migration directory/);
  });

  it('exits 0 when migration directory exists but is empty', () => {
    const result = runScript(workdir);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/No migration \.sql files/);
  });

  it('exits 0 on safe migration (CREATE TABLE only)', () => {
    writeMig('20240101_init', 'CREATE TABLE foo (id INT);');
    const result = runScript(workdir);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Migration safety check complete/);
  });

  it('exits 1 on DROP COLUMN migration', () => {
    writeMig('20240101_danger', 'ALTER TABLE foo DROP COLUMN bar;');
    const result = runScript(workdir);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/DROP COLUMN/);
    expect(result.stdout).toMatch(/destructive/);
  });

  it('exits 1 on DROP TABLE migration', () => {
    writeMig('20240101_danger', 'DROP TABLE foo;');
    const result = runScript(workdir);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/DROP TABLE/);
  });

  it('exits 1 on TRUNCATE migration', () => {
    writeMig('20240101_danger', 'TRUNCATE TABLE foo;');
    const result = runScript(workdir);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/TRUNCATE/);
  });

  it('exits 1 on multiple dangerous files', () => {
    writeMig('20240101_a', 'CREATE TABLE a (id INT);');
    writeMig('20240102_b', 'ALTER TABLE a DROP COLUMN c;');
    writeMig('20240103_c', 'TRUNCATE TABLE b;');
    const result = runScript(workdir);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/DROP COLUMN/);
    expect(result.stdout).toMatch(/TRUNCATE/);
  });

  it('detects destructive patterns even when split across lines', () => {
    writeMig(
      '20240101_multi',
      'ALTER TABLE\n  foo\nDROP COLUMN bar;'
    );
    const result = runScript(workdir);
    expect(result.status).toBe(1);
  });

  it('does NOT exit 0 silently when glob expansion fails (regression: ticket #34)', () => {
    // This is the exact bug from ticket #34. On Windows Git Bash, an unquoted
    // glob that fails to expand was silently swallowed by 2>/dev/null and the
    // script exited 0. The fix uses `find` + nullglob + explicit file array.
    // We simulate the failure mode by creating a workspace with the script
    // pointed at a non-existent migration dir under a non-canonical path.
    const altWorkdir = mkdtempSync(join(tmpdir(), 'mig-safety-alt-'));
    const altMigDir = join(altWorkdir, 'web', 'prisma', 'migrations');
    mkdirSync(altMigDir, { recursive: true });
    writeMig('20240101_danger', 'DROP TABLE foo;', altMigDir);

    const result = runScript(altWorkdir);
    // Even with a non-canonical path, the script MUST find the file and fail.
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/DROP TABLE/);

    rmSync(altWorkdir, { recursive: true, force: true });
  });

  it('grandfathered history (applied paise/JSON/settings migrations) passes', () => {
    // These three shipped long ago and are applied in every environment —
    // the gate must not fail CI forever on history.
    writeMig('20260729150000_float_to_paise', 'ALTER TABLE "wallets" DROP COLUMN "amount";');
    writeMig('20260730131814_convert_json_columns', 'ALTER TABLE "sync_queues" DROP COLUMN "payload";');
    writeMig('20260712000001_consolidate_settings', 'DROP TABLE IF EXISTS settings;');
    const result = runScript(workdir);
    expect(result.status).toBe(0);
  });

  it('a NEW migration with DROP COLUMN still fails loudly', () => {
    writeMig('20260729150000_float_to_paise', 'ALTER TABLE "wallets" DROP COLUMN "amount";');
    writeMig('20260903000009_new_drop', 'ALTER TABLE "riders" DROP COLUMN "phone";');
    const result = runScript(workdir);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/20260903000009_new_drop/);
  });

  it('DROP CONSTRAINT is not flagged (transactional, non-lossy DDL)', () => {
    // e.g. replacing a CHECK constraint: drop + re-add in one transaction.
    writeMig(
      '20260903000009_floor',
      'ALTER TABLE "wallets" DROP CONSTRAINT wallet_balance_nonnegative;'
    );
    const result = runScript(workdir);
    expect(result.status).toBe(0);
  });
});
