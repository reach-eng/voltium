/**
 * PR-115: notificationsCleanupJob worker registration regression guard.
 *
 * Audit (2026-08-04) found that `notifications-cleanup.job.ts` defined
 * `notificationsCleanupJob.process` but no entry in `WORKERS[]` in
 * `src/server/workers/index.ts` consumed `OutboxEventTypes.ADMIN_JOB_NOTIFICATIONS_CLEANUP`.
 *
 * Consequence: an admin clicking "Run now" on the Background Jobs screen
 * would enqueue the event but no worker would ever process it. The event
 * would sit PENDING until the outbox-completed-cleanup task purged it.
 *
 * This test asserts that the WORKERS array contains a consumer for the
 * notifications-cleanup outbox event type, and that the processor is the
 * notificationsCleanupJob exported by the job file.
 *
 * We can't import the runtime `WORKERS` array directly (it's not exported
 * from index.ts — the test would couple to the module's internal shape).
 * Instead, we assert the file content has the right wiring: the worker
 * entry exists in the WORKERS array, and the import is present.
 *
 * If you refactor `WORKERS` (rename, split, move to a new file), update
 * this test to match the new location.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const WORKERS_INDEX = resolve(
  __dirname,
  '../../../src/server/workers/index.ts'
);
const CLEANUP_JOB = resolve(
  __dirname,
  '../../../src/server/workers/jobs/notifications-cleanup.job.ts'
);

function readSafe(path: string): string {
  return existsSync(path) ? readFileSync(path, 'utf-8') : '';
}

describe('PR-115: notificationsCleanupJob is wired into WORKERS[]', () => {
  const indexSrc = readSafe(WORKERS_INDEX);
  const cleanupJobSrc = readSafe(CLEANUP_JOB);

  it('index.ts imports notificationsCleanupJob from the job file', () => {
    expect(indexSrc).toMatch(
      /import\s*\{[^}]*notificationsCleanupJob[^}]*\}\s*from\s*['"]\.\/jobs\/notifications-cleanup\.job['"]/
    );
  });

  it('index.ts registers a WORKERS[] entry for ADMIN_JOB_NOTIFICATIONS_CLEANUP', () => {
    // Match the worker block shape: jobType, processor, concurrency, description, priority
    const entryPattern = /jobType:\s*OutboxEventTypes\.ADMIN_JOB_NOTIFICATIONS_CLEANUP[\s\S]{0,400}processor:\s*notificationsCleanupJob\.process/;
    expect(indexSrc).toMatch(entryPattern);
  });

  it('the registered worker runs at background priority', () => {
    // Background priority — interactive per-event notification dispatch
    // (notification-dispatch.job) takes precedence.
    const entryPattern = /jobType:\s*OutboxEventTypes\.ADMIN_JOB_NOTIFICATIONS_CLEANUP[\s\S]{0,400}priority:\s*['"]background['"]/;
    expect(indexSrc).toMatch(entryPattern);
  });

  it('notifications-cleanup.job.ts still exports notificationsCleanupJob.process', () => {
    // The cleanup job file must keep the callable export the worker expects.
    expect(cleanupJobSrc).toMatch(
      /export\s+const\s+notificationsCleanupJob\s*=\s*\{[\s\S]*?async\s+process\s*\(/
    );
  });

  it('cleanup job deletes only read notifications older than 30 days', () => {
    // Sanity: the job's predicate has not been weakened (audit concern —
    // a weakened predicate could mass-delete unread notifications).
    expect(cleanupJobSrc).toMatch(/isRead:\s*true/);
    // 30 days = 30 * 24 * 60 * 60 * 1000
    expect(cleanupJobSrc).toMatch(/30\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
  });
});
