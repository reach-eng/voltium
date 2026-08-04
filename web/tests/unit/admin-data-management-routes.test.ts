/**
 * PR-136 (Phase 7G) — data-management route segments.
 *
 * All 30 admin sections render as one client-side app under `/admin` with
 * an in-memory section switcher. This worked for casual navigation but
 * broke the back button, deep-links, and sharing of URLs like
 * `/admin/data-management/restore`.
 *
 * PR-136 adds real Next.js route segments for the 7 data-management tabs:
 *   - /admin/data-management/overview
 *   - /admin/data-management/backups
 *   - /admin/data-management/schedule
 *   - /admin/data-management/restore
 *   - /admin/data-management/storage
 *   - /admin/data-management/logs
 *   - /admin/data-management/dr
 *
 * Each page is a thin `'use client'` re-export of the existing tab
 * component (so behavior is unchanged and code review stays small).
 *
 * What this test pins (so a future refactor that drops a route would
 * fail loudly):
 *   1. Each of the 7 page.tsx files exists.
 *   2. Each is a `'use client'` module that re-exports the canonical
 *      tab component as its default export.
 *   3. The default export name matches the source component name
 *      (no accidental rename).
 *
 * Why file-level checks instead of "actually render the route": Next.js
 * page components require the App Router runtime (RSC streaming,
 * `next/dynamic`, server boundaries) to render. Running those in
 * vitest's `node` environment is fragile. The shape of the page
 * modules is what Next.js uses to wire the route — a correct
 * `export { Foo as default }` IS the "renders without 404" contract
 * for our purposes.
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';

const WEB = resolve(__dirname, '../..');
const ROUTE_DIR = join(WEB, 'src/app/admin/data-management');
const TAB_DIR = join(WEB, 'src/components/admin/screens/data-management');

type RouteSpec = {
  segment: string;
  defaultExport: string;
  sourceFile: string;
};

const ROUTES: RouteSpec[] = [
  { segment: 'overview', defaultExport: 'OverviewTab', sourceFile: 'OverviewTab.tsx' },
  { segment: 'backups', defaultExport: 'BackupsTab', sourceFile: 'BackupsTab.tsx' },
  { segment: 'schedule', defaultExport: 'ScheduleTab', sourceFile: 'ScheduleTab.tsx' },
  { segment: 'restore', defaultExport: 'RestoreTab', sourceFile: 'RestoreTab.tsx' },
  { segment: 'storage', defaultExport: 'StorageTab', sourceFile: 'StorageTab.tsx' },
  { segment: 'logs', defaultExport: 'BackupLogsTab', sourceFile: 'BackupLogsTab.tsx' },
  { segment: 'dr', defaultExport: 'DisasterRecoveryTab', sourceFile: 'DisasterRecoveryTab.tsx' },
];

describe('PR-136 (Phase 7G) — /admin/data-management/* route segments', () => {
  for (const { segment, defaultExport, sourceFile } of ROUTES) {
    describe(`/admin/data-management/${segment}`, () => {
      const pagePath = join(ROUTE_DIR, segment, 'page.tsx');

      it('has a page.tsx that exists on disk (otherwise Next.js 404s the route)', () => {
        expect(existsSync(pagePath)).toBe(true);
      });

      it("page.tsx is a 'use client' module (the underlying tab is a client component)", () => {
        const content = readFileSync(pagePath, 'utf-8');
        expect(content).toMatch(/['"]use client['"]/);
      });

      it(`re-exports ${defaultExport} as default`, () => {
        const content = readFileSync(pagePath, 'utf-8');
        // Match either `export { Foo as default }` (the canonical form here)
        // or `export default Foo`. We want the form that re-exports the
        // existing tab component unchanged.
        const reExport = new RegExp(
          `export\\s*\\{\\s*${defaultExport}\\s+as\\s+default\\s*\\}`
        );
        expect(content).toMatch(reExport);
      });

      it('imports from the canonical tab path (so renames are caught)', () => {
        const content = readFileSync(pagePath, 'utf-8');
        // Import path drops the .tsx extension (Next.js convention).
        const importBaseName = sourceFile.replace(/\.tsx$/, '');
        expect(content).toContain('@/components/admin/screens/data-management/');
        expect(content).toContain(importBaseName);
      });

      it('does not duplicate tab logic (page should be a thin re-export)', () => {
        const content = readFileSync(pagePath, 'utf-8');
        // Sanity guard: no JSX, no useState, no fetch — those belong to the
        // tab component. A future contributor accidentally inlining logic
        // would be flagged.
        expect(content).not.toMatch(/<[A-Z][A-Za-z0-9]+/); // no JSX
        expect(content).not.toMatch(/useState|useEffect|useCallback/);
        expect(content).not.toMatch(/fetch\s*\(/);
      });
    });
  }

  it('source tab files still exist (the re-exports would otherwise 500)', () => {
    for (const { sourceFile } of ROUTES) {
      expect(existsSync(join(TAB_DIR, sourceFile))).toBe(true);
    }
  });

  it('data-management parent index still exists (in-memory section still works)', () => {
    // The new route segments are additive — they don't replace the
    // existing in-memory section switcher. Pinning this prevents
    // accidental regression of the existing UX.
    // Note: the canonical "section" component lives under components/, not
    // app/, because the AdminLayout loads it via `dynamic()` import.
    expect(existsSync(join(TAB_DIR, 'index.tsx'))).toBe(true);
  });
});
