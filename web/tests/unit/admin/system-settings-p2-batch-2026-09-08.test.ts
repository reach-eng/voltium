import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * P2 batch (system-settings section audit, 2026-09-08) — small UX /
 *  security / hygiene fixes that share the same surface.
 *
 *   P2-1: 401 handler used to redirect to `/admin/login`, a route
 *         that does not exist in the app router. Now reloads the
 *         admin shell so AdminLayout re-renders its inline login
 *         form.
 *   P2-2: updateAdmin() didn't bump `tokenVersion` on role or
 *         isActive change, leaving a 2h stale-privilege window on
 *         the system-settings PUT (UI gates on DB-fresh role, API
 *         enforces on JWT-stale role).
 *   P2-3: BACKUP_SECONDARY_ROOT clearable — already shipped in PR-2
 *         via the empty-string-allowed branch in validateInfraKey.
 *   P2-4: editable + frozen rows now render in separate screen
 *         sections (no mixed cards).
 *   P2-5: numeric infra readers' non-finite behavior — N/A after
 *         PR-1 froze the BACKUP_KEEP_* and BACKUP_MINIMUM_FREE_DISK_GB
 *         rows; the surviving editable keys (PATH, BOOLEAN, STRING)
 *         have no numeric readers.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..');
const USE_SYSTEM_SETTINGS = join(REPO_ROOT, 'src', 'components', 'admin', 'screens', 'system-settings', 'useSystemSettings.ts');
const SCREEN = join(REPO_ROOT, 'src', 'components', 'admin', 'screens', 'SystemSettingsScreen.tsx');
const ADMIN_USE_CASES = join(REPO_ROOT, 'src', 'server', 'modules', 'admin', 'admin.use-cases.ts');

function stripAllDocComments(text: string): string {
  return text.replace(/\/\*\*[\s\S]*?\*\//g, '');
}

describe('P2-1: 401 handler no longer redirects to /admin/login', () => {
  it('the GET handler reloads instead of redirecting to a non-existent route', () => {
    const text = stripAllDocComments(readFileSync(USE_SYSTEM_SETTINGS, 'utf8'));
    // Old: `window.location.href = '/admin/login'`
    // New: `window.location.reload()`
    expect(text).not.toMatch(/window\.location\.href\s*=\s*['"]\/admin\/login['"]/);
    expect(text).toMatch(/window\.location\.reload\s*\(\s*\)/);
  });

  it('the PUT handler reloads instead of redirecting to /admin/login', () => {
    const text = stripAllDocComments(readFileSync(USE_SYSTEM_SETTINGS, 'utf8'));
    // Two 401 branches — both must use reload, not /admin/login redirect.
    const reloadCount = (text.match(/window\.location\.reload\s*\(\s*\)/g) ?? []).length;
    expect(reloadCount).toBeGreaterThanOrEqual(2);
    const badRedirectCount = (text.match(/window\.location\.href\s*=\s*['"]\/admin\/login['"]/g) ?? []).length;
    expect(badRedirectCount).toBe(0);
  });
});

describe('P2-2: updateAdmin bumps tokenVersion on role or isActive change', () => {
  it('calls incrementTokenVersion when role changes', () => {
    const text = stripAllDocComments(readFileSync(ADMIN_USE_CASES, 'utf8'));
    expect(text).toMatch(/incrementTokenVersion/);
    // The bump must be conditional on a real role or isActive change
    // (not a no-op upsert).
    expect(text).toMatch(/roleChanged|activeChanged/);
  });

  it('does NOT bump tokenVersion on name/email/password-only updates', () => {
    // The check should be: only when role or isActive actually changed.
    const text = stripAllDocComments(readFileSync(ADMIN_USE_CASES, 'utf8'));
    // Verify the condition is gated on a delta:
    expect(text).toMatch(/params\.role\s*!==\s*undefined\s*&&\s*params\.role\s*!==\s*existing\.role/);
    expect(text).toMatch(/params\.isActive\s*!==\s*undefined\s*&&\s*params\.isActive\s*!==\s*existing\.isActive/);
  });
});

describe('P2-4: editable + frozen rows are split on the screen', () => {
  it('the screen splits rows into `editable` and `frozen` buckets', () => {
    const text = stripAllDocComments(readFileSync(SCREEN, 'utf8'));
    expect(text).toMatch(/const\s+\{\s*editable,\s*frozen\s*\}\s*=\s*useMemo/);
  });

  it('frozen rows render in a "Read-only display" section', () => {
    const text = readFileSync(SCREEN, 'utf8');
    expect(text).toMatch(/Read-only display/);
  });

  it('the editable bucket only contains `isEditable: true` rows', () => {
    const text = stripAllDocComments(readFileSync(SCREEN, 'utf8'));
    expect(text).toMatch(/setting\.isEditable\s*\?\s*editable\s*:\s*frozen/);
  });
});

describe('P2-3: BACKUP_SECONDARY_ROOT clearable via empty string (PR-2)', () => {
  it('validates empty string for BACKUP_SECONDARY_ROOT but not the other two root keys', () => {
    // This is a sanity test that PR-2's P2-3 fix is in place; the
    // canonical test is in system-settings-put-allowlist-2026-09-08.
    const text = readFileSync(
      join(REPO_ROOT, 'src', 'app', 'api', 'admin', 'system-settings', 'infra-key-validators.ts'),
      'utf8'
    );
    expect(text).toMatch(/BACKUP_SECONDARY_ROOT[\s\S]*if\s*\(trimmed\s*===\s*''\)\s*return\s*''/);
  });
});
