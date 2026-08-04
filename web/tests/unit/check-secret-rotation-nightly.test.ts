/**
 * PR-100 (INF-CI/CD-3) — verify secret-rotation nightly CI is wired
 *
 * Phase 6F (PR-94) shipped the secret-rotation script and wired the
 * nightly CI workflow. This test asserts the wiring is still in place
 * by checking:
 *
 *   1. scripts/check-secret-rotation.ts exists and exports a `main()`
 *   2. .github/workflows/secret-rotation-nightly.yml exists and
 *      invokes the script via `npx tsx ../scripts/check-secret-rotation.ts`
 *   3. web/tests/unit/scripts/check-secret-rotation.test.ts exists and
 *      tests exit-code behavior on stale vs clean secrets
 *
 * Pure file inspection — no runtime required.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '../../../');
const SCRIPT_PATH = resolve(ROOT, 'scripts/check-secret-rotation.ts');
const WORKFLOW_PATH = resolve(ROOT, '.github/workflows/secret-rotation-nightly.yml');
const TEST_PATH = resolve(__dirname, 'scripts/check-secret-rotation.test.ts');

describe('PR-100: secret-rotation nightly CI is wired', () => {
  it('scripts/check-secret-rotation.ts exists', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
  });

  it('the script has an explicit async main() function', () => {
    const content = readFileSync(SCRIPT_PATH, 'utf-8');
    // Must declare `async function main(`
    expect(content).toMatch(/async\s+function\s+main\s*\(/);
  });

  it('main() calls process.exit with the outcome exit code', () => {
    const content = readFileSync(SCRIPT_PATH, 'utf-8');
    // Must call process.exit with the outcome exit code
    expect(content).toMatch(/process\.exit\s*\(\s*outcome\.exitCode\s*\)/);
  });

  it('main() catches and reports errors with exit code 2', () => {
    const content = readFileSync(SCRIPT_PATH, 'utf-8');
    // Must have a try/catch and exit(2) on error
    expect(content).toMatch(/try\s*\{/);
    expect(content).toMatch(/process\.exit\s*\(\s*2\s*\)/);
  });

  it('main() is invoked when the script is run directly (not on import)', () => {
    const content = readFileSync(SCRIPT_PATH, 'utf-8');
    // Must have a direct-invocation guard + main() call
    expect(content).toMatch(/process\.argv\[1\]/);
    expect(content).toMatch(/void\s+main\s*\(\s*\)/);
  });

  it('.github/workflows/secret-rotation-nightly.yml exists', () => {
    expect(existsSync(WORKFLOW_PATH)).toBe(true);
  });

  it('the workflow invokes the script via npx tsx', () => {
    const content = readFileSync(WORKFLOW_PATH, 'utf-8');
    expect(content).toMatch(/npx\s+tsx\s+\.\.\/scripts\/check-secret-rotation\.ts/);
  });

  it('the workflow runs on a schedule (cron)', () => {
    const content = readFileSync(WORKFLOW_PATH, 'utf-8');
    expect(content).toMatch(/schedule:\s*\n\s*-\s*cron:/);
  });

  it('the workflow has a Notify on failure step that calls a webhook', () => {
    const content = readFileSync(WORKFLOW_PATH, 'utf-8');
    expect(content).toContain('Notify on failure');
    expect(content).toMatch(/ALERT_WEBHOOK_URL/);
  });

  it('web/tests/unit/scripts/check-secret-rotation.test.ts exists and tests exit codes', () => {
    expect(existsSync(TEST_PATH)).toBe(true);
    const content = readFileSync(TEST_PATH, 'utf-8');
    // Must test exit code 0 (clean) and exit code 1 (stale)
    expect(content).toMatch(/exitCode.*0/);
    expect(content).toMatch(/exitCode.*1/);
  });
});
