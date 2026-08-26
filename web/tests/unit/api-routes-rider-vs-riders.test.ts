/**
 * PR-M (Ticket #26.1) — verify /api/riders/* (plural) is fully removed and
 * /api/rider/register-token (singular) is in place.
 *
 * Background: per docs/AUDIT_TOP_LEVEL_SHELL_2026-07-30.md finding 3.1, the
 * plural /api/riders/ directory had 2 routes:
 *   - /api/riders/dashboard — ORPHAN (Flutter used /api/rider/dashboard singular)
 *   - /api/riders/register-token — IN USE (Flutter generated client called this)
 *
 * Cleanup:
 *   - Moved /api/riders/register-token → /api/rider/register-token (singular)
 *   - Deleted /api/riders/dashboard (orphan)
 *   - Deleted the entire /api/riders/ directory
 *
 * This test ensures:
 *   1. /api/rider/register-token/route.ts exists
 *   2. The openapi.ts and openapi.json canonical contracts reference the new path
 *   3. The Flutter generated client points at the new path
 *   4. The /api/riders/ directory is fully gone from the source tree
 *
 * Run: npx vitest run tests/unit/api-routes-rider-vs-riders.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const WEB = resolve(__dirname, '../..');
const API_DIR = join(WEB, 'src/app/api');
const ROUTE_REGISTER_TOKEN_NEW = join(API_DIR, 'rider/register-token/route.ts');
const DIR_RIDERS_OLD = join(API_DIR, 'riders');
const OPENAPI_TS = join(WEB, 'src/contracts/openapi.ts');
const OPENAPI_JSON = join(WEB, 'src/contracts/openapi.json');
const FLUTTER_CLIENT = resolve(WEB, '../flutter/lib/core/network/generated/api_client.dart');

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : '';
}

describe('PR-M (Ticket #26.1): /api/riders/ orphan cleanup', () => {
  it('new route file exists at /api/rider/register-token/route.ts', () => {
    expect(existsSync(ROUTE_REGISTER_TOKEN_NEW)).toBe(true);
    const content = readFileSync(ROUTE_REGISTER_TOKEN_NEW, 'utf-8');
    // Confirm it's the moved route (not a re-creation of a different shape)
    expect(content).toMatch(/export\s+async\s+function\s+POST/);
    expect(content).toMatch(/registerFcmToken/);
    expect(content).toMatch(/fcmToken/);
  });

  it('/api/riders/ directory is fully removed', () => {
    expect(existsSync(DIR_RIDERS_OLD)).toBe(false);
  });

  it('openapi.ts references the new path', () => {
    const content = readSafe(OPENAPI_TS);
    expect(content).toMatch(/'\/api\/rider\/register-token'/);
    expect(content).not.toMatch(/'\/api\/riders\/register-token'/);
  });

  it('openapi.json references the new path', () => {
    const content = readSafe(OPENAPI_JSON);
    expect(content).toMatch(/"\/api\/rider\/register-token"/);
    expect(content).not.toMatch(/"\/api\/riders\/register-token"/);
  });

  it('Flutter generated client uses the new path', () => {
    const content = readSafe(FLUTTER_CLIENT);
    expect(content).toMatch(/\/api\/rider\/register-token/);
    expect(content).not.toMatch(/\/api\/riders\/register-token/);
  });

  it('No file in src/ or tests/ still references /api/riders/ (other than this test)', () => {
    // Walk the source AND test trees and assert no file (other than the audit
    // doc, this test, and the moved route's header comment) references the
    // old path. The previous version only walked src/ + flutter/, which
    // missed stale test files in web/tests/ (caught in audit re-verify 2026-07-30).
    const offenders: string[] = [];
    function walk(dir: string) {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
          // Skip node_modules, coverage, .next
          if (entry === 'node_modules' || entry === 'coverage' || entry === '.next') continue;
          walk(full);
        } else if (st.isFile()) {
          // Only check TS/JS/Dart files
          if (!/\.(ts|tsx|js|jsx|dart|json|md)$/.test(entry)) continue;
          // Skip the test itself
          if (full === resolve(__filename)) continue;
          // Skip the audit doc (historical reference)
          if (full.includes('AUDIT_TOP_LEVEL_SHELL_2026-07-30.md')) continue;
          // Skip the comments inside the moved route file (they mention /api/riders/ for context)
          if (full === ROUTE_REGISTER_TOKEN_NEW) continue;
          // Skip the old openapi.json/ts if they exist (already updated)
          const content = readSafe(full);
          if (/\/api\/riders\/(register-token|dashboard)/.test(content)) {
            offenders.push(full);
          }
        }
      }
    }
    walk(API_DIR);
    walk(join(WEB, 'src'));
    walk(join(WEB, 'tests'));
    walk(resolve(WEB, '../flutter/lib'));
    walk(resolve(WEB, '../flutter/test'));
    walk(resolve(WEB, '../flutter/integration_test'));
    if (offenders.length > 0) {
      // Debug: print the offenders so the test output shows what to fix
      throw new Error(`Files still referencing /api/riders/* (old path):\n  ${offenders.join('\n  ')}`);
    }
    expect(offenders).toEqual([]);
  });
});
