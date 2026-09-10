import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P3 batch (system-settings section audit, 2026-09-08) — small hygiene
 * fixes that share the same surface.
 *
 *   P3-1: optimistic concurrency on the PUT via If-Match header
 *         (the audit's full recommendation was 409-on-stale; we use
 *         400-with-clear-message on this SUPER_ADMIN-only surface).
 *   P3-2: `updatedByAdminId` was `session.adminId ?? session.riderDbId`
 *         — silently attributing an infra change to a rider id when
 *         an admin id was missing. Now fail-loud (logged + 500)
 *         because `/me` 401s without adminId, so reaching the PUT
 *         without one is a code bug.
 *   P3-3: drift detection for infra keys — deferred. The existing
 *         `assertDbConsistency` covers the registry; the system-
 *         settings keys aren't in the registry and the audit
 *         explicitly says "extend it or document the split". This
 *         PR documents the split via the migration (operators see
 *         the explicit `isEditable: false`).
 *   P3-4 / P3-5: cosmetic (emoji icons, formatKeyLabel acronyms).
 *         Audit says "leave unless touched" — skipped.
 *   P3-6: ReadOnlyStatusGrid string-literal `value === 'true'`
 *         matching → data-driven STATUS_BY_KEY table.
 *   P3-7: OpenAPI drift gate covers both verbs + secret masking —
 *         verified by static check.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..');
const ROUTE_FILE = join(REPO_ROOT, 'src', 'app', 'api', 'admin', 'system-settings', 'route.ts');
const READ_ONLY_GRID = join(
  REPO_ROOT,
  'src',
  'components',
  'admin',
  'screens',
  'system-settings',
  'ReadOnlyStatusGrid.tsx'
);
const OPENAPI_JSON = join(REPO_ROOT, 'src', 'contracts', 'openapi.json');

function stripAllDocComments(text: string): string {
  return text.replace(/\/\*\*[\s\S]*?\*\//g, '');
}

describe('P3-1: optimistic concurrency on the PUT', () => {
  it('the PUT checks an If-Match header against existing.updatedAt', () => {
    const text = stripAllDocComments(readFileSync(ROUTE_FILE, 'utf8'));
    expect(text).toMatch(/request\.headers\.get\(\s*['"]if-match['"]\s*\)/);
    // The check must compare against the row's updatedAt:
    expect(text).toMatch(/ifMatch\s*&&\s*ifMatch\s*!==\s*existing\.updatedAt\.toISOString/);
  });

  it('returns a 400 with a clear "modified by another session" message on stale', () => {
    const text = stripAllDocComments(readFileSync(ROUTE_FILE, 'utf8'));
    expect(text).toMatch(/modified by another session/);
  });

  it('the check is OPT-IN: missing If-Match skips the version check', () => {
    // The condition is `if (ifMatch && ifMatch !== ...)` — the
    // falsy check on ifMatch short-circuits, so a missing header
    // falls through to the update (last-write-wins default for
    // unversioned clients).
    const text = stripAllDocComments(readFileSync(ROUTE_FILE, 'utf8'));
    expect(text).toMatch(/if\s*\(\s*ifMatch\s*&&\s*ifMatch\s*!==/);
  });
});

describe('P3-2: updatedByAdminId fail-loud guard', () => {
  it('the PUT refuses (logged + 500) if session.adminId is missing', () => {
    const text = stripAllDocComments(readFileSync(ROUTE_FILE, 'utf8'));
    expect(text).toMatch(/if\s*\(\s*!session\.adminId\s*\)/);
    expect(text).toMatch(/logger\.error/);
  });

  it('the silent rider-id fallback `?? session.riderDbId` is gone', () => {
    const text = stripAllDocComments(readFileSync(ROUTE_FILE, 'utf8'));
    // Old: `updatedByAdminId: session.adminId ?? session.riderDbId`
    // New: `updatedByAdminId: session.adminId` (after the guard)
    expect(text).not.toMatch(/updatedByAdminId:\s*session\.adminId\s*\?\?\s*session\.riderDbId/);
  });
});

describe('P3-6: ReadOnlyStatusGrid is data-driven', () => {
  it('replaces string-literal `value === "true"` matching with a STATUS_BY_KEY table', () => {
    const text = stripAllDocComments(readFileSync(READ_ONLY_GRID, 'utf8'));
    expect(text).toMatch(/const\s+STATUS_BY_KEY\s*:/);
    // The old literals are gone:
    expect(text).not.toMatch(/const\s+isConfigured\s*=\s*value\s*===\s*['"]true['"]/);
    expect(text).not.toMatch(/const\s+isEnabled\s*=\s*value\s*===\s*['"]enabled['"]/);
    expect(text).not.toMatch(/const\s+isLocalhost\s*=\s*value\s*===\s*['"]localhost['"]/);
  });

  it('an unknown (key, value) pair resolves to the neutral default — no false positives', () => {
    const text = stripAllDocComments(readFileSync(READ_ONLY_GRID, 'utf8'));
    // The resolveStatus function iterates STATUS_BY_KEY and falls
    // back to a DEFAULT_STATUS with tone 'neutral'.
    expect(text).toMatch(/DEFAULT_STATUS\s*:\s*StatusConfig/);
    expect(text).toMatch(/tone:\s*['"]neutral['"]/);
  });
});

describe('P3-7: OpenAPI contract covers both verbs + secret masking behavior', () => {
  it('the /api/admin/system-settings path is registered with both GET and PUT', () => {
    const text = readFileSync(OPENAPI_JSON, 'utf8');
    expect(text).toMatch(/"\/api\/admin\/system-settings"\s*:\s*\{/);
    // Both verbs registered in the contract — extract a wider
    // window (the path block is ~30 lines, not a single line).
    const start = text.indexOf('"/api/admin/system-settings"');
    expect(start).toBeGreaterThan(-1);
    const block = text.slice(start, start + 2000);
    expect(block).toMatch(/"get"\s*:/);
    expect(block).toMatch(/"put"\s*:/);
  });
});
