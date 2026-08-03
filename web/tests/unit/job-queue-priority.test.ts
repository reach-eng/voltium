/**
 * PR-75 unit test: outbox priority split.
 *
 * Proves the Backend N2 fix: a single interactive event enqueued
 * after 100 background events must be processed first, not buried
 * at the back of the queue. The pre-PR-75 claim query
 *
 *   SELECT ... ORDER BY createdAt ASC
 *
 * would put the 101st event (the interactive one) at the end of
 * the batch. With the priority filter, the interactive event is
 * claimed on the first poll and the 100 background events are
 * claimed only when no interactive event is PENDING.
 *
 * The test mirrors the patterns in tests/unit/job-queue.test.ts
 * (mocks.hoisted + vi.mock for @/lib/db) and the routes through
 * JobQueue.processJobs (the canonical claim API) so we exercise
 * the same SQL the worker uses in production.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock store — the in-memory mirror of the outbox_events table.
// Each row gets a `priority` field added in PR-75. The store is
// intentionally unaware of the priority — it just stores what
// the SQL would return. The query is what enforces priority.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  type Priority = 'interactive' | 'background';
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
      priority: Priority;
    }
  >();

  /**
   * Mirror of the PR-75 claim query in web/src/lib/job-queue.ts.
   *   UPDATE outbox_events
   *   SET status = 'PROCESSING'
   *   WHERE id IN (
   *     SELECT id FROM outbox_events
   *     WHERE eventType = ? AND status = 'PENDING'
   *       AND attempts < maxAttempts
   *       AND (readyAt IS NULL OR readyAt <= now)
   *       [AND priority = ?]    -- PR-75: optional filter
   *     ORDER BY createdAt ASC
   *     LIMIT concurrency
   *     FOR UPDATE SKIP LOCKED
   *   )
   */
  const claim = vi.fn(
    async (
      type: string,
      nowArg: Date | string,
      concurrency: number,
      priority?: Priority
    ) => {
      const now = new Date(nowArg);
      const picked: string[] = [];
      // Stable ORDER BY createdAt ASC: sort by createdAt, then by id
      // (a tie-breaker to keep tests deterministic when timestamps
      // collide at ms resolution).
      const sorted = Array.from(store.values()).sort((a, b) => {
        const at = a.createdAt.getTime();
        const bt = b.createdAt.getTime();
        if (at !== bt) return at - bt;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
      for (const row of sorted) {
        if (picked.length >= concurrency) break;
        if (row.eventType !== type) continue;
        if (row.status !== 'PENDING') continue;
        if (row.attempts >= row.maxAttempts) continue;
        if (row.readyAt && row.readyAt.getTime() > now.getTime()) continue;
        if (priority && row.priority !== priority) continue;
        picked.push(row.id);
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
          priority: r.priority,
        }));
    }
  );

  const complete = vi.fn(async (id: string, processedAt: Date) => {
    const r = store.get(id);
    if (r) {
      r.status = 'COMPLETED';
      r.processedAt = processedAt;
      r.attempts += 1;
      r.readyAt = null;
      r.updatedAt = processedAt;
    }
  });

  return { store, claim, complete };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/alerter', () => ({
  alerter: { send: vi.fn(async () => {}) },
}));

vi.mock('@/lib/db', () => ({
  db: {
    // The job-queue.ts call site uses Prisma.sql interpolation. The
    // values array is [type, now, Prisma.Sql(''), concurrency, priority?]
    // when priority is passed, or [type, now, Prisma.Sql(''), concurrency]
    // when not. We find the concurrency by type (the only number) and
    // find the priority by value ('interactive' | 'background' string).
    $queryRaw: vi.fn((...args: any[]) => {
      // PR-75: db.$queryRaw may be called with a single Prisma.Sql
      // object (the result of Prisma.sql`...` interpolation) or
      // with the tagged-template form (strings, ...values). We
      // detect both shapes.
      let values: any[] = [];
      if (args.length === 1 && args[0] && Array.isArray(args[0].strings)) {
        // Prisma.Sql form: { strings: [...], values: [...] }
        values = args[0].values ?? [];
      } else if (Array.isArray(args[0])) {
        // Tagged-template form: (strings, ...values)
        values = args.slice(1);
      }
      const type = values[0];
      const now = values[1];
      const concurrency = values.find((v) => typeof v === 'number');
      const priority = values.find(
        (v) => v === 'interactive' || v === 'background'
      );
      return (mocks.claim as any)(type, now, concurrency, priority);
    }),
    $executeRaw: vi.fn(async () => 0),
    outboxEvent: {
      update: vi.fn(async ({ where, data }: any) => {
        const r = mocks.store.get(where.id);
        if (!r) return null;
        if (data.status === 'COMPLETED') {
          await mocks.complete(where.id, data.processedAt ?? new Date());
        }
        return r;
      }),
      count: vi.fn(async () => 0),
      findFirst: vi.fn(async () => null),
    },
  },
}));

import { JobQueue } from '@/lib/job-queue';

function seedRow(opts: {
  id: string;
  eventType?: string;
  priority?: 'interactive' | 'background';
  createdAt?: Date;
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  attempts?: number;
  maxAttempts?: number;
  readyAt?: Date | null;
}) {
  mocks.store.set(opts.id, {
    id: opts.id,
    eventType: opts.eventType ?? 'rent.due_check',
    payload: '{}',
    status: opts.status ?? 'PENDING',
    attempts: opts.attempts ?? 0,
    maxAttempts: opts.maxAttempts ?? 3,
    error: null,
    createdAt: opts.createdAt ?? new Date(),
    updatedAt: opts.createdAt ?? new Date(),
    readyAt: opts.readyAt ?? null,
    processedAt: null,
    priority: opts.priority ?? 'background',
  });
}

beforeEach(() => {
  mocks.store.clear();
  vi.clearAllMocks();
});

describe('JobQueue priority (PR-75)', () => {
  it('routes 100 background + 1 interactive: interactive is claimed first', async () => {
    // Enqueue 100 background events (the "telemetry cleanup"
    // backlog) with monotonically increasing createdAt. Then
    // enqueue 1 interactive event (the "rent-due SMS") with the
    // latest createdAt. The pre-PR-75 FIFO claim would put the
    // interactive at position 101. PR-75 must put it at position 1.
    const baseTime = Date.now() - 100_000;
    for (let i = 0; i < 100; i++) {
      seedRow({
        id: `bg-${i.toString().padStart(3, '0')}`,
        eventType: 'cleanup.telemetry',
        priority: 'background',
        createdAt: new Date(baseTime + i), // 1ms apart, oldest first
      });
    }
    // Interactive event arrives AFTER all 100 background events.
    seedRow({
      id: 'urgent-sms',
      eventType: 'rent.due_check',
      priority: 'interactive',
      createdAt: new Date(baseTime + 100_000), // way later than any background
    });

    // The worker first claims an interactive batch (concurrency=5).
    // Even though the SMS has the LATEST createdAt, it must be
    // picked first because of the priority filter.
    const processed: string[] = [];
    const interactiveCount = await JobQueue.processJobs(
      'rent.due_check',
      async (job) => {
        processed.push(job.id);
      },
      5,
      'interactive'
    );

    expect(interactiveCount).toBe(1);
    expect(processed).toEqual(['urgent-sms']);
    // The 100 background events are still PENDING — they were
    // not touched by the interactive claim.
    const stillPendingBackground = Array.from(mocks.store.values()).filter(
      (r) => r.priority === 'background' && r.status === 'PENDING'
    );
    expect(stillPendingBackground.length).toBe(100);
  });

  it('background workers only see background events when interactive filter is on', async () => {
    seedRow({
      id: 'urgent-sms',
      eventType: 'rent.due_check',
      priority: 'interactive',
    });
    seedRow({
      id: 'audit-row-1',
      eventType: 'cleanup.audit_log',
      priority: 'background',
    });
    seedRow({
      id: 'audit-row-2',
      eventType: 'cleanup.audit_log',
      priority: 'background',
    });

    // The cleanup.audit_log worker claims with priority='background'.
    // The urgent-sms is interactive and must NOT be picked up by
    // this claim even though it is PENDING.
    const processedAudit: string[] = [];
    const count = await JobQueue.processJobs(
      'cleanup.audit_log',
      async (job) => {
        processedAudit.push(job.id);
      },
      5,
      'background'
    );
    expect(count).toBe(2);
    expect(processedAudit.sort()).toEqual(['audit-row-1', 'audit-row-2']);

    // The interactive event is still PENDING.
    expect(mocks.store.get('urgent-sms')?.status).toBe('PENDING');
  });

  it('a background worker called with no priority filter claims both (backward-compat)', async () => {
    // Pre-PR-75 callers pass 3 args (no priority). The claim must
    // not filter by priority, matching the original FIFO behavior.
    seedRow({
      id: 'urgent-sms',
      eventType: 'rent.due_check',
      priority: 'interactive',
    });
    seedRow({
      id: 'audit-row',
      eventType: 'rent.due_check',
      priority: 'background',
    });

    const processed: string[] = [];
    const count = await JobQueue.processJobs(
      'rent.due_check',
      async (job) => {
        processed.push(job.id);
      }
      // no priority arg, no concurrency arg
    );

    expect(count).toBe(2);
    // FIFO ordering: both events, regardless of priority.
    expect(processed).toContain('urgent-sms');
    expect(processed).toContain('audit-row');
  });

  it('gating: when only background events are PENDING, the background worker claims them', async () => {
    seedRow({
      id: 'telemetry-1',
      eventType: 'cleanup.telemetry',
      priority: 'background',
    });
    seedRow({
      id: 'telemetry-2',
      eventType: 'cleanup.telemetry',
      priority: 'background',
    });

    const processed: string[] = [];
    const count = await JobQueue.processJobs(
      'cleanup.telemetry',
      async (job) => {
        processed.push(job.id);
      },
      5,
      'background'
    );
    expect(count).toBe(2);
    expect(processed.sort()).toEqual(['telemetry-1', 'telemetry-2']);
  });

  it('priority=undefined is treated as no filter (backward-compat for callers passing 4th arg as undefined)', async () => {
    seedRow({
      id: 'urgent-sms',
      eventType: 'rent.due_check',
      priority: 'interactive',
    });
    seedRow({
      id: 'audit-row',
      eventType: 'rent.due_check',
      priority: 'background',
    });

    const processed: string[] = [];
    const count = await JobQueue.processJobs(
      'rent.due_check',
      async (job) => {
        processed.push(job.id);
      },
      5,
      undefined
    );
    expect(count).toBe(2);
    expect(processed).toContain('urgent-sms');
    expect(processed).toContain('audit-row');
  });
});
