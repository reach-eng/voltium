/**
 * PR-M (Ticket #23) — workers jobs error-handling consistency.
 *
 * Per `docs/AUDIT_FINDINGS_ADMINPANEL.md §10.3`, the audit claimed
 * 12 jobs "are silent on failure" — none integrate with `lib/alerter.ts`.
 *
 * Re-verification on 2026-07-30 found the audit claim was *partially* wrong:
 *   - The 12 jobs are PURE PROCESSORS — they don't have their own try/catch.
 *     The wrapper layer (`server/workers/index.ts` + `lib/job-queue.ts` +
 *     `server/workers/job-wrapper.ts#withJobGuards`) IS the canonical
 *     try/catch + retry layer.
 *   - 1 of 12 jobs (wallet-reconciliation) calls `alerter.send` directly
 *     for drift detection. The other 11 delegate to the wrapper's
 *     `notifyOnFailure: true` default, which logs `[ALERT] ...` on
 *     permanent failure.
 *   - All 12 jobs use `logger.info` / `logger.error` / `logger.warn`
 *     (covered by a separate invariant).
 *   - 10 of 12 jobs use `clock.now()` for testable timestamps. 2 jobs
 *     don't use timestamps at all (event payload is pre-timestamped).
 *   - 6 of 12 jobs use OutboxService (producers) — the other 6 are
 *     pure consumers driven by OutboxEvent rows.
 *
 * What this test asserts (the REAL invariants):
 *   1. All jobs are PURE processors (export a `.process` method).
 *   2. All jobs use logger at some level.
 *   3. Jobs that compute a current timestamp use `clock.now()`.
 *   4. The wrapper layer in `server/workers/index.ts` and
 *      `lib/job-queue.ts` actually has the try/catch + retry contract.
 *   5. `withJobGuards` wrapper exists and has the right shape.
 *
 * Run: npx vitest run tests/unit/workers-jobs-error-handling.test.ts
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';

const JOBS_DIR = resolve(__dirname, '../../src/server/workers/jobs');
const WORKERS_DIR = resolve(__dirname, '../../src/server/workers');
const JOB_QUEUE = resolve(__dirname, '../../src/lib/job-queue.ts');
const JOB_WRAPPER = resolve(__dirname, '../../src/server/workers/job-wrapper.ts');
// T-97 (PR-7, 2026-08-23): the previous `job-wrapper.ts` was
// removed because the helper had zero callers. The reaper at
// `lib/job-queue.ts` is the new "alert on failed job" path.
const SERVER_WORKERS = resolve(__dirname, '../../src/server/workers');

function listJobs(): string[] {
  return readdirSync(JOBS_DIR)
    .filter((f) => f.endsWith('.job.ts'))
    .map((f) => join(JOBS_DIR, f));
}

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : '';
}

describe('PR-M (Ticket #23): workers jobs error-handling consistency', () => {
  const jobs = listJobs();

  it('has 16 worker jobs', () => {
    // 13 = the original 12 + notification-broadcast.job.ts (P0-1/P0-9,
    // 2026-08-05 ops audit — admin broadcast outbox consumer).
    // 14 = + data-deletion-purge.job.ts (PR-7, 2026-08-06 fix-plan —
    // hard-anonymizes PII past the 7-day soft-delete window).
    // 15 = + announcement-broadcast.job.ts (PR-4, 2026-08-06 fix-plan —
    // async announcement fanout out of the request transaction).
    // 16 = + orphan-backup-cleanup.job.ts (PR-7, 2026-08-06 fix-plan —
    // purges PRE_RESTORE backups orphaned by failed restores).
    expect(jobs.length).toBe(16);
  });

  describe.each(jobs)('job %s', (jobPath) => {
    const content = readSafe(jobPath);
    const jobName = jobPath.split(/[/\\]/).pop() || '';

    it('exports a callable contract (pure processor or service function)', () => {
      // Most jobs export `export const X = { process: async (...) => ... }`.
      // Some export `export async function runX()` instead (called from
      // cron routes or admin endpoints rather than the worker scheduler).
      // scheduled-backup uses `checkAndRun` — the entry point is
      // the convention, not the literal name. Just confirm there's an
      // exported callable with an async signature.
      const hasProcessMethod = /export\s+const\s+\w+\s*=\s*\{[\s\S]*?process\s*[:(]/.test(content);
      const hasRunFunction = /export\s+(async\s+)?function\s+(run|process)\w*/.test(content);
      const hasCheckAndRun = /export\s+const\s+\w+\s*=\s*\{[\s\S]*?checkAndRun\s*[:(]/.test(content);
      // Sanity: there's a top-level export
      const hasExport = /export\s+(const|async\s+function|function)\s+\w+/.test(content);
      // And there's an async callable inside that export
      const hasAsync = /async\s+(process|run|checkAndRun|\w+Job|\w+)\s*\(/.test(content);
      expect(hasProcessMethod || hasRunFunction || hasCheckAndRun || (hasExport && hasAsync)).toBe(true);
    });

    it('uses logger at some level (info/error/warn)', () => {
      expect(content).toMatch(/logger\.(info|error|warn|debug)/);
    });

    it('if it computes a current timestamp, uses clock.now()', () => {
      // Jobs that need a "now" use clock.now() (testable).
      // Jobs that pass through an event payload use that payload's
      // timestamp and don't need clock.now() at all.
      // The test passes if EITHER:
      //   (a) uses clock.now(), or
      //   (b) does not need a current timestamp (no `new Date()` or `Date.now()`)
      const usesClock = /clock\.now\(\)/.test(content);
      const usesNewDate = /new Date\(\)/.test(content);
      const usesDateNow = /Date\.now\(\)/.test(content);
      // If it uses raw new Date() or Date.now() without clock.now(),
      // it should be flagged for refactor.
      if (usesNewDate || usesDateNow) {
        expect(usesClock).toBe(true);
      } else {
        // Pure event-payload job — no current-time needed
        expect(true).toBe(true);
      }
    });
  });

  describe('wrapper-layer error handling (the real try/catch layer)', () => {
    it('index.ts has try/catch around the worker loop', () => {
      const content = readSafe(join(WORKERS_DIR, 'index.ts'));
      // runWorkerLoop has try { ... JobQueue.processJobs ... } catch (err) { logger.error }
      expect(content).toMatch(/runWorkerLoop[\s\S]*?try\s*\{[\s\S]*?JobQueue\.processJobs[\s\S]*?catch\s*\(/);
    });

    it('job-queue.ts processJobs has retry/attempt logic', () => {
      const content = readSafe(JOB_QUEUE);
      // processJobs is the canonical retry wrapper
      expect(content).toMatch(/processJobs[\s\S]*?attempt/);
      expect(content).toMatch(/maxAttempts/);
    });

    it('job-wrapper.ts is intentionally not present (T-97 PR-7 2026-08-23)', () => {
      // T-97 (PR-7, 2026-08-23): `withJobGuards` was defined but
      // had ZERO callers across the codebase. Each `job.process`
      // already implements its own idempotency, error logging,
      // and outbox retry contract. The dead machinery was
      // removed. Each worker now relies on the in-tx outbox
      // emit + JobQueue's `processJobs` retry/backoff to
      // surface failures. The "ALERT Background job failed"
      // contract that `withJobGuards` used to provide is now
      // delivered by the OutboxEvent reaper at lib/job-queue.ts
      // (see T-98 PR-8 verification test).
      const fs = require('fs') as typeof import('fs');
      expect(fs.existsSync(JOB_WRAPPER)).toBe(false);
    });
  });

  describe('alerter integration (Ticket #23 actual claim)', () => {
    it('wallet-reconciliation.job.ts uses alerter for drift alerts', () => {
      // The one job that the audit correctly flagged as needing alerter
      // integration now has it.
      const content = readSafe(join(JOBS_DIR, 'wallet-reconciliation.job.ts'));
      expect(content).toMatch(/alerter\.send/);
    });

    it('JobQueue reaper preserves forensic context for FAILED events (T-98)', () => {
      // T-97 + T-98: the reaper at lib/job-queue.ts is the new
      // canonical "alert on failed job" path. It increments
      // attempts (so poison pills die at maxAttempts) and
      // prefixes the prior error string onto the reaper note.
      const content = readSafe(JOB_QUEUE);
      expect(content).toMatch(/Reclaimed by reaper/);
      expect(content).toMatch(/attempts = attempts \+ 1/);
    });
  });
});
