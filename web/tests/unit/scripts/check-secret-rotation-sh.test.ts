/**
 * Test for scripts/check-secret-rotation.sh (PR-139 / INF-CI/CD-4)
 * ----------------------------------------------------------------
 * Phase 6F (PR-94) added scripts/check-secret-rotation.ts and wired the
 * nightly cron job. The daily ci-cd.yml step at .github/workflows/ci-cd.yml:162
 * (`bash ../scripts/check-secret-rotation.sh`) referenced a file that did
 * not exist — the step was a silent no-op because check-migration-safety.sh
 * ran first and short-circuited. PR-139 adds the wrapper.
 *
 * These tests guard against the wrapper being removed in a future refactor.
 * They assert:
 *   1. The .sh file exists at scripts/check-secret-rotation.sh.
 *   2. The .sh file is executable (chmod +x).
 *   3. The .sh file invokes `npx tsx scripts/check-secret-rotation.ts`
 *      (or the absolute equivalent) so the actual logic is wired.
 *   4. The ci-cd.yml workflow references the .sh file.
 *
 * Pure node-side checks (no spawnSync to bash) so the test runs on Windows
 * without requiring Git Bash in PATH.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, statSync, readFileSync } from 'fs';
import { resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '../../../..');
// __dirname = web/tests/unit/scripts → 4 levels up = repo root
const SH_PATH = resolve(REPO_ROOT, 'scripts/check-secret-rotation.sh');
const TS_PATH = resolve(REPO_ROOT, 'scripts/check-secret-rotation.ts');
const CI_CD_PATH = resolve(REPO_ROOT, '.github/workflows/ci-cd.yml');

describe('scripts/check-secret-rotation.sh (PR-139 / INF-CI/CD-4)', () => {
  it('the shell wrapper file exists', () => {
    expect(existsSync(SH_PATH)).toBe(true);
  });

  it('the underlying TypeScript implementation exists', () => {
    expect(existsSync(TS_PATH)).toBe(true);
  });

  it('the shell wrapper is executable', () => {
    expect(existsSync(SH_PATH)).toBe(true);
    const stat = statSync(SH_PATH);
    // On POSIX the executable bit shows up in mode & 0o111. On Windows
    // statSync.mode does not reliably reflect the executable bit (NTFS
    // ACLs are not represented), so we accept either: the mode has any
    // executable bit set, OR the file ends in .sh and exists. Operators
    // on Windows invoke via `bash scripts/check-secret-rotation.sh` so
    // the bit is irrelevant there.
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      // Existence is sufficient on Windows — bash is invoked explicitly.
      expect(stat.isFile()).toBe(true);
    } else {
      expect(stat.mode & 0o111).not.toBe(0);
    }
  });

  it('the shell wrapper delegates to the TypeScript implementation', () => {
    const content = readFileSync(SH_PATH, 'utf-8');
    // The wrapper must invoke npx tsx (or node) against the .ts file —
    // otherwise it would be a no-op stub that masks failures (the original
    // bug). Accept either an absolute path or a relative one.
    const invokesTsx =
      /npx\s+tsx\s+.*check-secret-rotation\.ts/.test(content) ||
      /exec\s+npx\s+tsx\s+/.test(content);
    expect(invokesTsx).toBe(true);
  });

  it('the shell wrapper uses `set -euo pipefail` for fail-fast behavior', () => {
    const content = readFileSync(SH_PATH, 'utf-8');
    // The wrapper must fail loudly on errors — same posture as
    // check-migration-safety.sh — so a missing tsx binary or a
    // broken .ts file surfaces as a non-zero exit in CI rather
    // than a silent pass.
    // The wrapper must declare `set` with `-e` and `pipefail` somewhere
    // in the same line — otherwise an error in the npx tsx call would
    // silently pass. We accept any of the common forms:
    //   set -euo pipefail
    //   set -eu -o pipefail
    //   set -e -u -o pipefail
    const setLine = content.split('\n').find((l) => /^\s*set\s+-/.test(l));
    expect(setLine, 'expected a `set -` line in the wrapper').toBeDefined();
    expect(setLine!).toMatch(/-e/);   // -e (errexit)
    expect(setLine!).toMatch(/pipefail/);
  });

  it('ci-cd.yml references the shell wrapper', () => {
    // Regression guard: if the workflow is edited to remove the step,
    // PR-139 is no longer effective. The expected step is at
    // .github/workflows/ci-cd.yml:162-163.
    expect(existsSync(CI_CD_PATH)).toBe(true);
    const workflow = readFileSync(CI_CD_PATH, 'utf-8');
    expect(workflow).toContain('check-secret-rotation.sh');
  });
});
