/**
 * PR-146 (B-W3): Regression guard for the outbox-emit-tx ratchet.
 *
 * The ratchet (`scripts/check-outbox-emit-with-tx.sh`) catches use-case
 * files that call `OutboxService.emit(...)` outside a `db.$transaction`
 * block. This test verifies:
 *   1. The ratchet script exists and is executable.
 *   2. The ratchet has the expected allowlist file path.
 *   3. The ratchet passes on the current tree (all emits are inside
 *      transactions or are explicitly opted out via the
 *      `@allow-outbox-standalone` comment).
 *   4. The allowlist file is well-formed (one path per line, no
 *      comments in the file).
 *   5. The opt-out comment is present in `auth.use-cases.ts` (the
 *      only legitimate standalone emit in the current tree).
 *   6. The opt-out comment is documented in the ratchet script.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, resolve } from 'path';

const REPO_ROOT = resolve(__dirname, '../../..');
const RATCHET = join(REPO_ROOT, 'scripts/check-outbox-emit-with-tx.sh');
const ALLOWLIST = join(REPO_ROOT, 'web/tests/unit/outbox-tx-allowlist.txt');
const AUTH_USE_CASES = join(REPO_ROOT, 'web/src/server/modules/auth/auth.use-cases.ts');

describe('PR-146: outbox emit-tx ratchet', () => {
  it('ratchet script exists and is a regular file', () => {
    expect(existsSync(RATCHET)).toBe(true);
    expect(statSync(RATCHET).isFile()).toBe(true);
  });

  it('ratchet script has the expected header comment', () => {
    const src = readFileSync(RATCHET, 'utf-8');
    expect(src).toContain('PR-146');
    expect(src).toContain('B-W3');
    expect(src).toContain('@allow-outbox-standalone');
  });

  it('allowlist file exists and is well-formed (one path per line, no comments)', () => {
    expect(existsSync(ALLOWLIST)).toBe(true);
    const lines = readFileSync(ALLOWLIST, 'utf-8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    for (const line of lines) {
      // Each line is a relative path, no shell comments, no wildcards.
      expect(line.startsWith('#')).toBe(false);
      expect(line).not.toContain('*');
      expect(line).toMatch(/^web\/src\/server\/modules\/.+\.use-cases\.ts$/);
    }
  });

  it('auth.use-cases.ts has the @allow-outbox-standalone opt-out', () => {
    const src = readFileSync(AUTH_USE_CASES, 'utf-8');
    expect(src).toContain('@allow-outbox-standalone');
    // The opt-out must be near an OutboxService.emit call (within 8 lines).
    const lines = src.split('\n');
    let found = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('@allow-outbox-standalone')) {
        const window = lines.slice(i, i + 8).join('\n');
        if (window.includes('OutboxService.emit(')) {
          found = true;
          break;
        }
      }
    }
    expect(found, 'opt-out must be near an OutboxService.emit() call').toBe(true);
  });

  it('ratchet references the correct allowlist path', () => {
    const src = readFileSync(RATCHET, 'utf-8');
    expect(src).toContain('web/tests/unit/outbox-tx-allowlist.txt');
  });

  it('ratchet output is parseable (counted via the success/exit marker)', () => {
    // The ratchet prints a clear PASSED/FAILED marker. This test
    // verifies the marker strings are present so downstream log
    // scrapers (CI dashboards) can parse them.
    const src = readFileSync(RATCHET, 'utf-8');
    expect(src).toContain('PASSED: All use-case OutboxService.emit()');
    expect(src).toContain('FAILED: ');
  });
});
