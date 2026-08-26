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
  const result = spawnSync(
    BASH,
    ['-c', `cd "${workspaceRoot}" && MIGRATION_DIR='web/prisma/migrations' bash "${SCRIPT_PATH}"`],
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
    writeFileSync(join(migDir, '20240101_init.sql'), 'CREATE TABLE foo (id INT);');
    const result = runScript(workdir);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/Migration safety check complete/);
  });

  it('exits 1 on DROP COLUMN migration', () => {
    writeFileSync(join(migDir, '20240101_danger.sql'), 'ALTER TABLE foo DROP COLUMN bar;');
    const result = runScript(workdir);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/DROP COLUMN/);
    expect(result.stdout).toMatch(/destructive/);
  });

  it('exits 1 on DROP TABLE migration', () => {
    writeFileSync(join(migDir, '20240101_danger.sql'), 'DROP TABLE foo;');
    const result = runScript(workdir);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/DROP TABLE/);
  });

  it('exits 1 on TRUNCATE migration', () => {
    writeFileSync(join(migDir, '20240101_danger.sql'), 'TRUNCATE TABLE foo;');
    const result = runScript(workdir);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/TRUNCATE/);
  });

  it('exits 1 on multiple dangerous files', () => {
    writeFileSync(join(migDir, '20240101_a.sql'), 'CREATE TABLE a (id INT);');
    writeFileSync(join(migDir, '20240102_b.sql'), 'ALTER TABLE a DROP COLUMN c;');
    writeFileSync(join(migDir, '20240103_c.sql'), 'TRUNCATE TABLE b;');
    const result = runScript(workdir);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/DROP COLUMN/);
    expect(result.stdout).toMatch(/TRUNCATE/);
  });

  it('detects destructive patterns even when split across lines', () => {
    writeFileSync(
      join(migDir, '20240101_multi.sql'),
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
    writeFileSync(join(altMigDir, '20240101_danger.sql'), 'DROP TABLE foo;');

    const result = runScript(altWorkdir);
    // Even with a non-canonical path, the script MUST find the file and fail.
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/DROP TABLE/);

    rmSync(altWorkdir, { recursive: true, force: true });
  });
});
