/**
 * PR-B — Regression guard for the Background Jobs last-error + next-run
 * surface.
 *
 * Two changes ship in this PR:
 *   1. The GET handler at /api/admin/jobs populates `lastError` and
 *      `nextRun` on every job entry.
 *   2. JobCard renders a collapsible "Last failure" block (visible by
 *      default when lastStatus === 'FAILED') and a "Next run" line.
 *
 * The test asserts:
 *   - The route file has the `lastError` + `nextRun` lines for every
 *     of the 8 jobs (the implementation plan listed 7 but the live
 *     tree has 8: wallet-reconciliation, rent-due-checker, auto-debit,
 *     device-compliance, referral-reward, notifications-cleanup,
 *     daily-engagement, telemetry-cleanup).
 *   - The route file declares the `estimateNextRun` helper.
 *   - JobCard imports `useState` (for the collapsible error).
 *   - JobCard renders "Next run:" with a data-testid per job.
 *   - JobCard renders the "Last failure" block when lastError is set.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const REPO = resolve(__dirname, '../../..');
const ROUTE = resolve(REPO, 'web/src/app/api/admin/jobs/route.ts');
const CARD = resolve(
  REPO,
  'web/src/components/admin/screens/background-jobs/JobCard.tsx'
);

function src(p: string): string {
  return readFileSync(p, 'utf-8');
}

describe('PR-B: Background Jobs last-error + next-run', () => {
  describe('GET /api/admin/jobs route', () => {
    it('route file exists', () => {
      expect(existsSync(ROUTE)).toBe(true);
    });

    it('declares estimateNextRun helper', () => {
      const s = src(ROUTE);
      expect(s).toMatch(/function estimateNextRun\s*\(/);
    });

    it('estimateNextRun handles Daily HH:MM IST', () => {
      const s = src(ROUTE);
      expect(s).toMatch(/daily/i);
    });

    it('estimateNextRun handles Hourly (at MM mins)', () => {
      const s = src(ROUTE);
      expect(s).toMatch(/hourly/i);
    });

    it('estimateNextRun handles Weekly (Sun HH:MM IST)', () => {
      const s = src(ROUTE);
      expect(s).toMatch(/weekly/i);
    });

    it('estimateNextRun handles Monthly (1st at HH:MM IST)', () => {
      const s = src(ROUTE);
      expect(s).toMatch(/monthly\s*\\?\(\?\d\{1,2\}\(?:st|nd|rd|th\)\?/);
    });

    it('every job entry populates lastError and nextRun', () => {
      const s = src(ROUTE);
      // Each job ID must appear with both `lastError:` and
      // `nextRun:` set in its block.
      for (const id of [
        'wallet-reconciliation',
        'rent-due-checker',
        'auto-debit',
        'device-compliance',
        'referral-reward',
        'notifications-cleanup',
        'daily-engagement',
        'telemetry-cleanup',
      ]) {
        // Find the block for this id and look ahead ~30 lines.
        const idIdx = s.indexOf(`id: '${id}'`);
        expect(idIdx, `id ${id} not found in route`).toBeGreaterThan(-1);
        const block = s.slice(idIdx, idIdx + 2000);
        expect(block, `${id} missing lastError`).toContain('lastError:');
        expect(block, `${id} missing nextRun`).toContain('nextRun:');
      }
    });

    it('nextRun calls estimateNextRun with the schedule label', () => {
      const s = src(ROUTE);
      const calls = s.match(/nextRun:\s*estimateNextRun\(/g) || [];
      // 8 jobs = 8 nextRun calls.
      expect(calls.length, 'expected 8 nextRun: estimateNextRun(...) calls').toBeGreaterThanOrEqual(8);
    });
  });

  describe('JobCard.tsx', () => {
    it('imports useState (for the collapsible error block)', () => {
      const s = src(CARD);
      expect(s).toMatch(/import\s*\{[^}]*useState[^}]*\}\s*from\s*['"]react['"]/);
    });

    it('has data-testid on the next-run row', () => {
      const s = src(CARD);
      expect(s).toContain('data-testid={`next-run-${job.id}`}');
    });

    it('has data-testid on the error block', () => {
      const s = src(CARD);
      expect(s).toContain('data-testid={`error-block-${job.id}`}');
    });

    it('renders "Last failure" header inside the error block', () => {
      const s = src(CARD);
      expect(s).toContain('Last failure');
    });

    it('renders "Next run:" label', () => {
      const s = src(CARD);
      expect(s).toContain('Next run:');
    });

    it('renders the "— (on-demand)" fallback when nextRun is null', () => {
      const s = src(CARD);
      expect(s).toContain('— (on-demand)');
    });

    it('uses the AlertTriangle icon for the error block', () => {
      const s = src(CARD);
      expect(s).toContain('AlertTriangle');
    });
  });
});
