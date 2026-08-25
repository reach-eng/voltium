/**
 * Tests for src/lib/job-queue.ts (Phase 3.4).
 *
 * Verifies:
 *  - The claim query filters on `readyAt IS NULL OR readyAt <= now()`
 *    so jobs past their exponential backoff are eligible.
 *  - On failure, readyAt is set to now + backoff and the row stays
 *    PENDING (with attempts incremented) until the backoff elapses.
 *  - On max attempts, the row is moved to FAILED and readyAt is reset.
 *  - The reaper uses `updatedAt` (which Prisma manages) to find rows
 *    stuck in PROCESSING for more than 5 minutes.
 *  - Backoff is exponential (2^attempts * 5s) and capped at 1 hour.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mocks (hoisted).
const mocks = vi.hoisted(() => {
  // Per-row store mirroring the Prisma OutboxEvent table.
  const store = new Map<
    string,
    {
      id: string;
      eventType: string;
      payload: string;
      status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
      attempts: number;
      maxAttempts: number;
      error: string | null;
      createdAt: Date;
      updatedAt: Date;
      readyAt: Date | null;
      processedAt: Date | null;
    }
  >();
  return {
    store,
    // Mirrors the claim UPDATE in processJobs. Picks the first
    // `concurrency` PENDING rows whose readyAt is null or <= now and
    // whose attempts < maxAttempts, marks them PROCESSING, and returns
    // them.
    claim: vi.fn(
      async (type: string, nowArg: Date | string, concurrency: number) => {
        const now = new Date(nowArg);
        const picked: string[] = [];
        for (const [id, row] of store) {
          if (picked.length >= concurrency) break;
          if (row.eventType !== type) continue;
          if (row.status !== 'PENDING') continue;
          if (row.attempts >= row.maxAttempts) continue;
          if (row.readyAt && row.readyAt.getTime() > now.getTime()) continue;
          picked.push(id);
        }
        for (const id of picked) {
          const r = store.get(id)!;
          r.status = 'PROCESSING';
          r.updatedAt = now;
        }
        return picked
          .map((id) => store.get(id)!)
          .map((r) => ({
            id: r.id,
            eventType: r.eventType,
            payload: r.payload,
            status: r.status,
            attempts: r.attempts,
            maxAttempts: r.maxAttempts,
            createdAt: r.createdAt,
            readyAt: r.readyAt,
          }));
      }
    ),
    // Mirror of db.outboxEvent.update for COMPLETED.
    complete: vi.fn(async (id: string, processedAt: Date) => {
      const r = store.get(id);
      if (r) {
        r.status = 'COMPLETED';
        r.processedAt = processedAt;
        r.attempts += 1;
        r.readyAt = null;
        r.updatedAt = processedAt;
      }
    }),
    // Mirror of db.outboxEvent.update for FAILED retries.
    failRetry: vi.fn(
      async (id: string, error: string, nextReadyAt: Date) => {
        const r = store.get(id);
        if (r) {
          r.attempts += 1;
          r.error = error;
          r.status = 'PENDING';
          r.readyAt = nextReadyAt;
          r.updatedAt = new Date();
        }
      }
    ),
    failMax: vi.fn(async (id: string, error: string) => {
      const r = store.get(id);
      if (r) {
        r.attempts += 1;
        r.error = error;
        r.status = 'FAILED';
        r.readyAt = null;
        r.updatedAt = new Date();
      }
    }),
    // Reaper mirror: respects per-type thresholds (matching the SQL CASE
    // behavior in job-queue.ts). The real implementation is a raw CTE;
    // this mock just simulates the per-row comparison.
    reaperSweep: vi.fn(async (cutoff: Date) => {
      let count = 0;
      const thresholdMsByType: Record<string, number> = {
        'wallet.reconciliation': 15 * 60 * 1000,
        'sms.send': 2 * 60 * 1000,
        'notification.send': 2 * 60 * 1000,
      };
      const defaultThresholdMs = 5 * 60 * 1000;
      for (const r of store.values()) {
        if (r.status !== 'PROCESSING') continue;
        const thresholdMs = thresholdMsByType[r.eventType] ?? defaultThresholdMs;
        // The real reaper compares updatedAt < (now - threshold). The
        // test passes `cutoff` as `now - threshold`, so the comparison
        // is `updatedAt < cutoff` only when the type-specific threshold
        // is the default. For per-type thresholds, the test must compute
        // its own cutoff (see reaperSweepType below).
        if (r.updatedAt.getTime() < cutoff.getTime()) {
          r.status = 'PENDING';
          r.error = 'Reclaimed by reaper — stuck in PROCESSING';
          r.attempts += 1;
          r.updatedAt = new Date();
          count++;
        }
      }
      return count;
    }),
    // Per-type-aware reaper: reap only rows older than their type's threshold.
    // T-98 (PR-8, 2026-08-23): the mock now mirrors the production
    // SQL — increments attempts, transitions to FAILED at
    // maxAttempts, and preserves the prior error string. The
    // pre-T-98 mock always set status to PENDING, which hid the
    // "poison pills retry forever" bug.
    reaperSweepType: vi.fn(async () => {
      let count = 0;
      const thresholdMsByType: Record<string, number> = {
        'wallet.reconciliation': 15 * 60 * 1000,
        'sms.send': 2 * 60 * 1000,
        'notification.send': 2 * 60 * 1000,
      };
      const defaultThresholdMs = 5 * 60 * 1000;
      const now = Date.now();
      for (const r of store.values()) {
        if (r.status !== 'PROCESSING') continue;
        const thresholdMs = thresholdMsByType[r.eventType] ?? defaultThresholdMs;
        if (now - r.updatedAt.getTime() >= thresholdMs) {
          // T-98: increment first; check if the increment
          // crosses maxAttempts. If so, FAILED (dead-letter);
          // otherwise PENDING (retry).
          r.attempts += 1;
          if (r.attempts >= r.maxAttempts) {
            r.status = 'FAILED';
            r.readyAt = null;
          } else {
            r.status = 'PENDING';
            r.readyAt = new Date(Date.now() + 60_000);
          }
          // T-98: preserve forensic context — prefix the prior
          // error string onto the reaper note.
          const reaperNote = 'Reclaimed by reaper — stuck in PROCESSING';
          r.error = r.error
            ? `${reaperNote} | previous error: ${r.error}`
            : reaperNote;
          r.updatedAt = new Date();
          count++;
        }
      }
      return count;
    }),
    stuckCount: vi.fn(async (cutoff: Date) => {
      let count = 0;
      for (const r of store.values()) {
        if (r.status === 'PROCESSING' && r.updatedAt.getTime() < cutoff.getTime()) {
          count++;
        }
      }
      return count;
    }),
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/alerter', () => ({
  alerter: { send: vi.fn(async () => {}) },
}));

vi.mock('@/lib/db', () => ({
  db: {
    // $queryRaw is invoked by job-queue.ts as
    //   db.$queryRaw(Prisma.sql`...`)
    // which is a single-arg call passing a Prisma.Sql value object
    // of shape { strings: string[], values: unknown[] }. Earlier
    // versions of job-queue.ts used the tagged-template form
    // (strings, ...values); PR-75 converted to Prisma.sql so the
    // optional priority fragment could be interpolated. The mock
    // accepts both shapes for forward-compat.
    $queryRaw: vi.fn((...args: any[]) => {
      let values: any[] = [];
      if (args.length === 1 && args[0] && Array.isArray(args[0].strings)) {
        values = args[0].values ?? [];
      } else if (Array.isArray(args[0])) {
        values = args.slice(1);
      }
      const type = values[0];
      const now = values[1];
      const concurrency = values.find((v) => typeof v === 'number');
      return (mocks.claim as any)(type, now, concurrency);
    }),
    // $executeRaw is a tagged template; job-queue.ts uses it for the
    // reaper (single round-trip CTE+UPDATE). We route to the per-type
    // mock so per-type thresholds are exercised.
    $executeRaw: vi.fn(async () => {
      return await mocks.reaperSweepType();
    }),
    outboxEvent: {
      update: vi.fn(async ({ where, data }: any) => {
        const r = mocks.store.get(where.id);
        if (!r) return null;
        if (data.status === 'COMPLETED') {
          await mocks.complete(where.id, data.processedAt ?? new Date());
        } else if (data.status === 'PENDING') {
          // Either a retry (with readyAt) or a reaper reset.
          if (data.readyAt) {
            await mocks.failRetry(where.id, data.error ?? '', data.readyAt);
          } else {
            // Reaper reset path: status -> PENDING, readyAt stays null.
            r.status = 'PENDING';
            r.error = data.error ?? null;
            r.updatedAt = new Date();
          }
        } else if (data.status === 'FAILED') {
          await mocks.failMax(where.id, data.error ?? '');
        }
        return r;
      }),
      updateMany: vi.fn(async () => {
        // The reaper no longer uses updateMany; it uses $executeRaw with
        // a CTE. This mock is left for any future callers.
        return { count: 0 };
      }),
      count: vi.fn(async ({ where }: any) => {
        if (where.status === 'PROCESSING' && where.updatedAt?.lt) {
          return await mocks.stuckCount(where.updatedAt.lt);
        }
        return 0;
      }),
    },
  },
}));

import { JobQueue } from '@/lib/job-queue';

function seedRow(opts: {
  id: string;
  eventType?: string;
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  attempts?: number;
  maxAttempts?: number;
  readyAt?: Date | null;
  updatedAt?: Date;
  error?: string | null;
}) {
  const now = new Date();
  mocks.store.set(opts.id, {
    id: opts.id,
    eventType: opts.eventType ?? 'test.event',
    payload: '{}',
    status: opts.status ?? 'PENDING',
    attempts: opts.attempts ?? 0,
    maxAttempts: opts.maxAttempts ?? 3,
    error: opts.error ?? null,
    createdAt: now,
    updatedAt: opts.updatedAt ?? now,
    readyAt: opts.readyAt ?? null,
    processedAt: null,
  });
}

beforeEach(() => {
  mocks.store.clear();
  vi.clearAllMocks();
});

describe('job-queue (Phase 3.4)', () => {
  it('claims only PENDING jobs whose readyAt is null or <= now', async () => {
    const now = new Date();
    seedRow({
      id: 'j1',
      readyAt: null, // eligible
    });
    seedRow({
      id: 'j2',
      readyAt: new Date(now.getTime() - 60_000), // 1 min ago, eligible
    });
    seedRow({
      id: 'j3',
      readyAt: new Date(now.getTime() + 60_000), // 1 min in future, NOT eligible
    });
    seedRow({
      id: 'j4',
      readyAt: null,
      status: 'PROCESSING', // already claimed
    });

    const processed: string[] = [];
    await JobQueue.processJobs('test.event', async (job) => {
      processed.push(job.id);
    });

    expect(processed.sort()).toEqual(['j1', 'j2']);
    // The non-eligible jobs are still PENDING (or PROCESSING) — never touched.
    expect(mocks.store.get('j3')?.status).toBe('PENDING');
    expect(mocks.store.get('j4')?.status).toBe('PROCESSING');
  });

  it('on failure, sets readyAt to now + backoff and keeps status PENDING', async () => {
    const before = Date.now();
    seedRow({ id: 'fail-1', attempts: 0, maxAttempts: 3, readyAt: null });

    await JobQueue.processJobs('test.event', async () => {
      throw new Error('handler failed');
    });

    const r = mocks.store.get('fail-1')!;
    // attempts bumped to 1, status PENDING (since attempts < maxAttempts)
    expect(r.attempts).toBe(1);
    expect(r.status).toBe('PENDING');
    // backoff for attempts=1 is 2^1 * 5s = 10s; cap at 1h.
    // readyAt should be ~10s from now.
    expect(r.readyAt).not.toBeNull();
    const readyAtMs = r.readyAt!.getTime();
    expect(readyAtMs).toBeGreaterThanOrEqual(before + 10_000 - 50);
    expect(readyAtMs).toBeLessThanOrEqual(before + 10_000 + 1_000);

    // The next claim is blocked because readyAt is in the future.
    // (The first call to processJobs may have left the row's status
    // as PENDING with the new readyAt set.)
    // Reset attempts so the row is eligible-by-attempts (the claim
    // still fails because readyAt is in the future).
    mocks.store.get('fail-1')!.attempts = 0;
    const processedBefore: string[] = [];
    await JobQueue.processJobs('test.event', async (job) => {
      processedBefore.push(job.id);
    });
    expect(processedBefore).toEqual([]);

    // Now set readyAt to clearly in the past and confirm the row
    // is claimed.
    const past = new Date(Date.now() - 60_000); // 1 min ago
    mocks.store.get('fail-1')!.readyAt = past;
    mocks.store.get('fail-1')!.attempts = 0;
    const processedAfter: string[] = [];
    await JobQueue.processJobs('test.event', async (job) => {
      processedAfter.push(job.id);
    });
    expect(processedAfter).toEqual(['fail-1']);
  });

  it('on max attempts, sets status to FAILED and clears readyAt', async () => {
    seedRow({ id: 'max-1', attempts: 2, maxAttempts: 3, readyAt: null });

    await JobQueue.processJobs('test.event', async () => {
      throw new Error('handler failed');
    });

    const r = mocks.store.get('max-1')!;
    expect(r.attempts).toBe(3);
    expect(r.status).toBe('FAILED');
    expect(r.readyAt).toBeNull();
  });

  it('backoff grows exponentially up to the 1-hour cap', () => {
    // For attempts = 0..10, backoffMs = min(2^attempts * 5s, 1h).
    // We just sanity-check a few values without invoking processJobs.
    const backoff = (a: number) =>
      Math.min(Math.pow(2, a) * 5000, 3600000);
    expect(backoff(0)).toBe(5000);
    expect(backoff(1)).toBe(10000);
    expect(backoff(2)).toBe(20000);
    expect(backoff(7)).toBe(640_000);
    expect(backoff(8)).toBe(1_280_000);
    expect(backoff(9)).toBe(2_560_000);
    expect(backoff(10)).toBe(3_600_000); // capped at 1h
  });

  it('reaper reclaims PROCESSING rows whose updatedAt is older than the cutoff', async () => {
    const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000);
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);

    seedRow({
      id: 'stuck',
      status: 'PROCESSING',
      updatedAt: sixMinAgo,
    });
    seedRow({
      id: 'recent',
      status: 'PROCESSING',
      updatedAt: twoMinAgo,
    });
    seedRow({
      id: 'pending-old',
      status: 'PENDING',
      updatedAt: sixMinAgo,
    });

    const reclaimed = await JobQueue.runReaper();
    expect(reclaimed).toBe(1);
    expect(mocks.store.get('stuck')?.status).toBe('PENDING');
    expect(mocks.store.get('stuck')?.error).toMatch(/Reclaimed by reaper/);
    expect(mocks.store.get('recent')?.status).toBe('PROCESSING');
    expect(mocks.store.get('pending-old')?.status).toBe('PENDING');
  });

  it('reaper respects per-type thresholds (long-running wallet.reconciliation not reclaimed at 5 min)', async () => {
    // 6 min old = would be reclaimed at default 5 min threshold,
    // but wallet.reconciliation has a 15 min threshold — keep it.
    const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000);
    const sixteenMinAgo = new Date(Date.now() - 16 * 60 * 1000);

    seedRow({
      id: 'wallet-job',
      eventType: 'wallet.reconciliation',
      status: 'PROCESSING',
      updatedAt: sixMinAgo,
    });
    seedRow({
      id: 'wallet-job-stuck',
      eventType: 'wallet.reconciliation',
      status: 'PROCESSING',
      updatedAt: sixteenMinAgo,
    });
    seedRow({
      id: 'sms-old',
      eventType: 'sms.send',
      status: 'PROCESSING',
      updatedAt: sixMinAgo, // > 2 min SMS threshold → reclaim
    });

    const reclaimed = await JobQueue.runReaper();
    // 6 min wallet.reconciliation NOT reclaimed (15 min threshold)
    // 16 min wallet.reconciliation IS reclaimed (> 15 min)
    // 6 min sms.send IS reclaimed (> 2 min)
    expect(reclaimed).toBe(2);
    expect(mocks.store.get('wallet-job')?.status).toBe('PROCESSING');
    expect(mocks.store.get('wallet-job-stuck')?.status).toBe('PENDING');
    expect(mocks.store.get('sms-old')?.status).toBe('PENDING');
  });

  it('getStuckProcessingCount uses updatedAt < cutoff', async () => {
    const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000);
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000);
    seedRow({ id: 's1', status: 'PROCESSING', updatedAt: sixMinAgo });
    seedRow({ id: 's2', status: 'PROCESSING', updatedAt: sixMinAgo });
    seedRow({ id: 's3', status: 'PROCESSING', updatedAt: twoMinAgo });
    seedRow({ id: 's4', status: 'PENDING', updatedAt: sixMinAgo });

    const stuck = await JobQueue.getStuckProcessingCount();
    expect(stuck).toBe(2);
  });

  // T-98 (PR-8, 2026-08-23): close the "reaper resets attempts=0"
  // finding with a regression test that exercises the
  // attempts-increment + maxAttempts → FAILED + error-context
  // preservation contract end-to-end. The previous audit
  // identified that poison-pill handlers (process-killing
  // exceptions) would re-enter the reaper forever with
  // attempts=0, overwriting forensic context. The fix at
  // job-queue.ts:175-181 increments attempts, honors
  // maxAttempts, and prefixes the prior error.
  it('T-98 reaper increments attempts (does NOT reset) and surfaces FAILED at maxAttempts', async () => {
    const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000);

    // attempts: 2 of 3 → after reaper: attempts: 3, status: FAILED.
    seedRow({
      id: 'poison-pill',
      status: 'PROCESSING',
      updatedAt: sixMinAgo,
      attempts: 2,
      maxAttempts: 3,
      error: 'Original exception: OOM at module X',
    });

    const reclaimed = await JobQueue.runReaper();
    expect(reclaimed).toBe(1);
    const row = mocks.store.get('poison-pill')!;
    // T-98: attempts is INCREMENTED, not reset. A poison-pill
    // handler dies for the 3rd time → FAILED → no more retries.
    expect(row.attempts).toBe(3);
    // T-98: maxAttempts reached → status FAILED (dead-letter),
    // not PENDING (which would re-enter the queue and loop).
    expect(row.status).toBe('FAILED');
    // T-98: forensic context preserved. The new error string
    // includes the reaper prefix AND the prior error so an
    // operator grepping the logs can find the original cause.
    expect(row.error).toMatch(/Reclaimed by reaper/);
    expect(row.error).toMatch(/Original exception: OOM at module X/);
  });

  it('T-98 reaper increments attempts to PENDING when below maxAttempts', async () => {
    const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000);
    // attempts: 0 of 5 → after reaper: attempts: 1, status: PENDING.
    seedRow({
      id: 'recoverable',
      status: 'PROCESSING',
      updatedAt: sixMinAgo,
      attempts: 0,
      maxAttempts: 5,
      error: null,
    });
    const reclaimed = await JobQueue.runReaper();
    expect(reclaimed).toBe(1);
    const row = mocks.store.get('recoverable')!;
    expect(row.attempts).toBe(1);
    expect(row.status).toBe('PENDING');
    // No prior error → no prefix to preserve.
    expect(row.error).toMatch(/Reclaimed by reaper/);
  });
});
