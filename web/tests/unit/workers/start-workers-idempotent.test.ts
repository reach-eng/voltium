/**
 * TG-11 (audits/2026-08-05-scheduled-cron-tasks.md:599): startWorkers is idempotent
 *
 * The workers entry point (server/workers/index.ts:509) has a
 * `if (running) return` guard at line 510 so a second call to
 * startWorkers() is a no-op. The guard uses a module-private
 * `let running = false` flag (line 504) so subsequent calls early-
 * exit before wiring up new AbortControllers or scheduling new
 * worker loops.
 *
 * The test mocks the inner worker loop + scheduled-task loop +
 * reaper loop to no-op so the test doesn't actually start a real
 * worker pool. What we care about is the entry-point idempotency
 * invariant: the second call returns early without spinning up a
 * second pool.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockProcessJobs = vi.fn().mockResolvedValue(0);
const mockRunReaper = vi.fn().mockResolvedValue(0);
const mockCheckAndRun = vi.fn().mockResolvedValue({ ran: false, reason: 'no schedule' });
const mockHasPendingInteractive = vi.fn().mockResolvedValue(false);

vi.mock('@/lib/db', () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('@/lib/job-queue', () => ({
  JobQueue: {
    processJobs: mockProcessJobs,
    runReaper: mockRunReaper,
  },
}));

vi.mock('@/server/modules/data-management/backup.repository', () => ({
  backupRepository: {
    getSchedule: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/server/modules/data-management/backup.service', () => ({
  getFreeDiskBytes: vi.fn().mockResolvedValue(50 * 1024 * 1024 * 1024),
}));

vi.mock('@/server/workers/jobs/scheduled-backup.job', () => ({
  scheduledBackupJob: {
    checkAndRun: mockCheckAndRun,
  },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/clock', () => ({
  clock: { now: () => new Date('2026-09-02T00:00:00Z') },
}));

const { startWorkers, stopWorkers } = await import(
  '@/server/workers/index'
);

async function importOutboxAndOutboxMock() {
  // The workers module imports the outbox service at the top.
  // Ensure a no-op shim so the worker loops can be reset cleanly.
}

describe('startWorkers — TG-11 idempotency', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockProcessJobs.mockResolvedValue(0);
    mockRunReaper.mockResolvedValue(0);
    mockCheckAndRun.mockResolvedValue({ ran: false, reason: 'no schedule' });
    mockHasPendingInteractive.mockResolvedValue(false);
    // Reset the module-private `running` flag between tests by
    // calling stopWorkers, which sets `running = false` and aborts
    // the AbortController.
    try {
      await stopWorkers();
    } catch {
      // stopWorkers may throw if no workers were running; ignore.
    }
  });

  it('a single call to startWorkers begins setup (running flips true)', async () => {
    // The function does not await the inner loops (they return
    // promises via Promise.all but each loop is a while-running
    // busy-loop). We can't easily await startWorkers() end-to-end
    // without flaking; instead we verify the side-effects of the
    // synchronous prefix: a running flag flip + log line.
    //
    // Since the test is in a single-process Node test, the running
    // flag is module-internal. We test the **idempotency** invariant
    // (the second call returns early), not the running flag itself.
    const firstCall = startWorkers();

    // The second call should be a no-op (the `if (running) return;`
    // guard at line 510). The first call's inner loops are still
    // busy-looping, so `running` is true.
    const secondCall = startWorkers();

    // Both promises settle — first is an unresolving busy-loop; we
    // race them and expect the second to resolve quickly because of
    // the early return.
    const secondResult = await Promise.race([
      secondCall.then(() => 'second-resolved'),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 100)),
    ]);
    expect(secondResult).toBe('second-resolved');

    // The first call is still busy-looping. Stop it to clean up.
    await stopWorkers();
    // Resolve the first call's outer Promise.all (which is waiting
    // for the inner loops to finish; stopWorkers sets `running =
    // false` so each loop exits). Use a short timeout to confirm
    // the first call resolves.
    await Promise.race([
      firstCall,
      new Promise((_, reject) => setTimeout(() => reject(new Error('first call did not resolve after stopWorkers')), 1000)),
    ]);
  });
});
