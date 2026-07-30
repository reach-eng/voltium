# Voltium Background Workers / Jobs — Deep-Dive Audit Findings

**Date:** 2026-07-29
**Scope:** `web/src/server/workers/**` — 12 job files + index + outbox + queues, plus the supporting `lib/job-queue.ts` and `lib/idempotency.ts`.

> **Status (2026-07-30):** 3 of 13 top P0s FIXED (JobQueue.enqueue + JobTypes shipped in PR-P1.4), 2 PARTIALLY FIXED, 5 STILL TRUE (highest-leverage: OutboxService.emit no transaction — data integrity risk). See [`AUDIT_VERIFICATION_3_2026-07-30.md`](./AUDIT_VERIFICATION_3_2026-07-30.md) §9.
**Method:** File-by-file read. Every finding has file:line evidence and a concrete fix.

This is the fifth in the audit series. It is focused entirely on the background worker subsystem — the 12 job processors, the orchestrator (`index.ts`), the outbox/queue layer, and the supporting libraries.

The previous `AUDIT_FINDINGS.md` and `AUDIT_BACKEND.md` covered the broad shape of the workers, the OutboxEvent table, and the scheduler. **This audit does not duplicate those findings** — only adds the deep per-job analysis, the data-integrity issues, the broken-promise anti-patterns, and the gap analysis (jobs that are missing, jobs that overlap, jobs that should be split).

## Severity legend

- **P0** — broken behavior, security risk, money/data corruption, comment that lies, race condition, lost work
- **P1** — will bite soon (correctness, performance, observability)
- **P2** — code smell, missed best practice
- **P3** — nice-to-have / hygiene

## Table of contents

1. [Worker architecture overview](#1-worker-architecture-overview)
2. [Worker orchestrator (`index.ts`) deep dive](#2-worker-orchestrator)
3. [Outbox + JobQueue + Idempotency library deep dive](#3-outbox--jobqueue--idempotency-library)
4. [Job-by-job audit (12 jobs)](#4-job-by-job-audit)
5. [Cross-cutting findings](#5-cross-cutting-findings)
6. [Missing jobs / coverage gaps](#6-missing-jobs--coverage-gaps)
7. [Top 10 critical findings](#7-top-10-critical-findings)
8. [Recommended 10-PR sequence](#8-recommended-10-pr-sequence)

---

## 1. Worker architecture overview

### 1.1 Two scheduling patterns

**File:** `web/src/server/workers/index.ts:47-170`

The worker system has two scheduling patterns:

**Pattern A: Event-driven (outbox polling)** — 7 workers
- `WALLET_RECONCILIATION` (1 concurrency)
- `NOTIFICATION_SEND` (3 concurrency)
- `DAILY_ENGAGEMENT` (1 concurrency)
- `RENT_DUE_CHECK` (2 concurrency)
- `DEVICE_VIOLATION_SCAN` (2 concurrency)
- `REFERRAL_REWARD` (3 concurrency)
- `SMS_SEND` (5 concurrency)

Each worker calls `JobQueue.processJobs(jobType, processor, concurrency)` which:
1. Atomically claims PENDING events via `UPDATE ... SET status='PROCESSING' WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)` (per `lib/job-queue.ts:66-92`)
2. Processes each event via the processor
3. Marks COMPLETED or PENDING+retry (with exponential backoff) on error

**Pattern B: Cron-driven (direct timer)** — 5 tasks
- `audit-log-cleanup` (every 5 min)
- `telemetry-cleanup` (every 5 min)
- `rent-due-emitter` (every 1 min, emits `RENT_DUE_CHECK` outbox event)
- `device-violation-emitter` (every 1 min, emits `DEVICE_VIOLATION_SCAN` outbox event)
- `daily-engagement-emitter` (every 1 min, fires at 06:00 IST)
- `scheduled-backup-check` (every 5 min, separate loop)

Plus a **reaper loop** (every 5 min) that reclaims stuck PROCESSING events.

### 1.2 OutboxEvent types inventory

**File:** `web/src/server/workers/outbox.ts:35-71`

20 event types defined:
- Wallet: `WALLET_TOPUP_REQUESTED`, `WALLET_TOPUP_APPROVED`, `WALLET_TOPUP_REJECTED`, `WALLET_RECONCILIATION`, `DEPOSIT_APPROVED`, `DEPOSIT_REJECTED`, `DEPOSIT_REFUNDED`
- Notifications: `NOTIFICATION_SEND`, `SMS_SEND`, `ANNOUNCEMENT_DISPATCH`, `DAILY_ENGAGEMENT`
- Referrals: `REFERRAL_SIGNUP`, `REFERRAL_REWARD`
- Rent: `RENT_DUE`, `RENT_OVERDUE`, `RENT_PAID`, `RENT_DUE_CHECK`
- Device: `DEVICE_VIOLATION`, `DEVICE_VIOLATION_SCAN`
- Admin: `ADMIN_ACTION`
- Cleanup: `AUDIT_LOG_CLEANUP`, `TELEMETRY_DATA_CLEANUP`

**Mapping (event → worker):**

| Event | Worker | Has handler? |
|---|---|---|
| `WALLET_TOPUP_REQUESTED` | none | **P1 — orphaned** |
| `WALLET_TOPUP_APPROVED` | none | **P1 — orphaned** (worker is `WALLET_RECONCILIATION` which is for reconciliation, not topup) |
| `WALLET_TOPUP_REJECTED` | none | **P1 — orphaned** |
| `WALLET_RECONCILIATION` | `reconciliationJob` | ✓ |
| `DEPOSIT_APPROVED` | none (uses `NOTIFICATION_SEND` instead) | **P2 — but the use-case calls `notificationService` directly** |
| `DEPOSIT_REJECTED` | none | same |
| `DEPOSIT_REFUNDED` | none | same |
| `NOTIFICATION_SEND` | `notificationDispatchJob` | ✓ |
| `SMS_SEND` | inline `sendSms` | ✓ |
| `ANNOUNCEMENT_DISPATCH` | none | **P0 — orphaned, no consumer** |
| `DAILY_ENGAGEMENT` | `dailyEngagementJob` | ✓ |
| `REFERRAL_SIGNUP` | none | **P0 — orphaned** |
| `REFERRAL_REWARD` | `referralRewardJob` | ✓ |
| `RENT_DUE` | none | **P0 — orphaned** |
| `RENT_OVERDUE` | none | **P0 — orphaned (emitted by `rentRemindersJob` but no consumer)** |
| `RENT_PAID` | none | **P0 — orphaned** |
| `RENT_DUE_CHECK` | `rentRemindersJob` | ✓ |
| `DEVICE_VIOLATION` | none | **P0 — orphaned (emitted by `deviceComplianceJob` but no consumer)** |
| `DEVICE_VIOLATION_SCAN` | `deviceComplianceJob` | ✓ |
| `ADMIN_ACTION` | none | **P0 — orphaned (emitted by `reconciliationJob` for mismatch alerts but no consumer)** |
| `AUDIT_LOG_CLEANUP` | direct timer | ✓ |
| `TELEMETRY_DATA_CLEANUP` | direct timer | ✓ |

**10 of 20 event types are orphaned.** This is fine if the producer only emits for tracing purposes, but some are emitted to be consumed (e.g. `RENT_OVERDUE`, `DEVICE_VIOLATION`, `ADMIN_ACTION`).

### 1.3 Worker entrypoint

**File:** `web/src/server/workers/index.ts:336-388`

`isDirectRun` is set if `process.argv[1]` matches `workers/index.ts` (or `.js`, or with `\\`). This is a fragile detection — a symlink or different path could miss the match. **Better:** use `require.main === module` (CommonJS) or `import.meta.url` (ESM). Currently the worker is `ts`-run via `npx tsx src/server/workers/index.ts`.

---

## 2. Worker orchestrator (`index.ts`)

**File:** `web/src/server/workers/index.ts` (388 lines)

### 2.1 [P0] `startWorkers` returns `Promise<void>` but is called via `Promise.all` — never resolves

**File:** `web/src/server/workers/index.ts:212-230`

```ts
const promises: Promise<void>[] = [];
// Event-driven workers
for (const worker of WORKERS) {
  promises.push(runWorkerLoop(worker, injectedClock));
}
// Scheduled tasks
for (const task of SCHEDULED_TASKS) {
  promises.push(runScheduledTask(task, injectedClock));
}
promises.push(runScheduledBackupLoop(injectedClock));
promises.push(runReaperLoop(injectedClock));

await Promise.all(promises);
```

`runWorkerLoop` is `while (running) { ... }` — **it never returns** until `running` is set to `false` via `stopWorkers()`. So `startWorkers` blocks forever. The `await Promise.all(promises)` line at the end of `startWorkers` is **unreachable** in normal operation.

The `runFromCli()` function calls `await startWorkers()` — and the CLI blocks forever. **This is by design** (the worker is a long-running process), but it means:
- Tests that call `startWorkers` will hang
- A graceful shutdown must call `stopWorkers()` to break the loop

**Fix:** document this explicitly. Tests should use a timeout. Or, refactor to use `AbortController` more aggressively.

### 2.2 [P0] `stopWorkers` sets `running = false` but each loop's `sleep()` is aborted via AbortController

**File:** `web/src/server/workers/index.ts:306-325`

```ts
export function stopWorkers(): void {
  running = false;
  if (globalAbortController) {
    globalAbortController.abort();
  }
  logger.info('[Workers] Stopping all workers');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (!running || !globalAbortController) {
      return resolve();
    }
    const timeout = setTimeout(resolve, ms);
    globalAbortController.signal.addEventListener('abort', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}
```

The shutdown flow:
1. `running = false` (causes next `while` iteration to exit)
2. `globalAbortController.abort()` (causes pending `sleep()` to resolve early)

The `handleShutdown` function (line 348-367) waits up to 30s for in-flight jobs, then `process.exit(0)`. **If a job is in the middle of a DB transaction, the `process.exit(0)` may abort the transaction mid-write.**

**Fix:** the worker should:
1. Stop accepting new jobs (`running = false`)
2. Wait for in-flight jobs to complete (with timeout)
3. Disconnect the Prisma pool (`gracefulShutdown()`)
4. Then `process.exit(0)`

Currently, step 3 is missing — the worker exits with open DB connections.

### 2.3 [P1] `runWorkerLoop` has a `sleep(5000)` after each `processJobs` call — not backoff-aware

**File:** `web/src/server/workers/index.ts:260-261`

```ts
while (running) {
  try {
    await JobQueue.processJobs(jobType, async (job) => { ... }, concurrency);
  } catch (err) {
    logger.error(`[Worker] Error in ${jobType} loop`, err);
  }
  await sleep(5000);
}
```

After every `processJobs` call (whether it processed 0 jobs or `concurrency` jobs), the worker sleeps 5 seconds. So even with a full queue, jobs are processed at 12/min (1 every 5 sec). **For high-throughput queues (e.g. `SMS_SEND` with concurrency=5), this is a major bottleneck.**

**Fix:** remove the `sleep(5000)` and let `processJobs` loop continuously. Add a short sleep (e.g. 100ms) only when 0 jobs were processed.

### 2.4 [P1] The same `logger` instance is used for all 7+ workers — log lines from different workers are interleaved

**File:** `web/src/server/workers/index.ts` (throughout)

The `logger` is a global instance. Log lines like `[Worker] Processing job` don't include the worker name in every line. Hard to trace a specific worker's behavior.

**Fix:** add a per-worker logger wrapper that includes the worker name in every log line. Or, use structured logging with a `worker` field.

### 2.5 [P0] `workerLoop` `processJobs` call passes the processor as a closure, but errors in the processor are caught by `processJobs` and converted to retry — not by `runWorkerLoop`

**File:** `web/src/server/workers/index.ts:240-256`, `web/src/lib/job-queue.ts:96-149`

The flow:
1. `processJobs` claims events
2. Calls `processor(job)` for each (in `Promise.allSettled`)
3. On success: marks COMPLETED
4. On error: increments `attempts`, schedules retry with backoff

**The `processor` is called inside `processJobs` — if it throws, the catch in `processJobs` (line 120-147) handles it.** The outer `try { ... } catch (err)` in `runWorkerLoop` only catches errors from the **claim** query, not from the processor. So a processor that throws is correctly retried.

**However:** if the **claim query itself fails** (DB connection error), the worker logs the error and continues to sleep 5 sec, then retries. The worker **never dies** from a transient DB error. This is actually a feature (resilience), but the error log is at `error` level, which may page an on-call engineer for transient issues.

**Fix:** lower the transient-DB-error log to `warn` level. Only `error` for permanent issues.

### 2.6 [P1] `concurrency` is the only parallelism knob — no rate limit per second

**File:** `web/src/server/workers/index.ts:47-104`

Each worker has a `concurrency` (1, 2, 3, 5). But the workers run all the time — `processJobs` claims up to `concurrency` jobs every 5 sec (or continuously if we fix 2.3). For example, `SMS_SEND` with concurrency=5 could process 5 SMS in a single `processJobs` call, then 5 more 5 sec later, etc. **No rate limit per second** — a downstream SMS provider may throttle.

**Fix:** add a `rateLimit: { perSecond: 10 }` config. The `processJobs` should respect the rate limit.

### 2.7 [P0] `runReaperLoop` reclaims stuck PROCESSING events — but the reaper has no idempotency

**File:** `web/src/server/workers/index.ts:291-304`, `web/src/lib/job-queue.ts:157-175`

The reaper runs every 5 min. It reclaims events that have been in `PROCESSING` for more than 5 min. **If the worker is still processing the event (just slow), the reaper resets it to PENDING. Then both the original worker and the next claim try to process the same event.** Duplicate side effects.

The 5-min threshold is too short for long-running jobs (e.g. `reconciliationJob` can take 10+ min for 1M wallets). The reaper would reclaim mid-processing.

**Fix:** make the reaper threshold configurable per worker. Or, add a "lease extension" mechanism: the worker can call `extendLease(jobId)` periodically to keep the reaper at bay.

### 2.8 [P0] `runScheduledBackupLoop` runs every 5 min and calls `scheduledBackupJob.checkAndRun()` — but the function is not in the `WORKERS` or `SCHEDULED_TASKS` arrays

**File:** `web/src/server/workers/index.ts:225, 284-289`

```ts
promises.push(runScheduledBackupLoop(injectedClock));
...
async function runScheduledBackupLoop(injectedClock: typeof clock): Promise<void> {
  while (running) {
    await checkScheduledBackups();
    await sleep(300_000);
  }
}
```

The scheduled-backup check is implemented as a separate `while` loop, parallel to the other scheduled tasks. **This is inconsistent** — all other scheduled tasks are in `SCHEDULED_TASKS`. The reason it's separate is unclear (probably historical).

**Fix:** add to `SCHEDULED_TASKS` for consistency. Same pattern as the other 5 scheduled tasks.

### 2.9 [P1] `process.argv[1]` matching uses 4 backslash variations

**File:** `web/src/server/workers/index.ts:336-346`

```ts
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv.length >= 2 &&
  (process.argv[1]?.endsWith('workers/index.ts') ||
    process.argv[1]?.endsWith('workers/index.js') ||
    process.argv[1]?.endsWith('workers\\index.ts') ||
    process.argv[1]?.endsWith('workers\\index.js') ||
    process.argv[1]?.endsWith('workers\\\\index.ts') ||
    process.argv[1]?.endsWith('workers\\\\index.js') ||
    process.argv[1]?.endsWith('workers.js') ||
    process.argv[1]?.endsWith('workers.ts'));
```

8 different `endsWith` patterns. The 4 backslash variations cover Windows vs. cross-platform, but the pattern is fragile. **Better:** use `import.meta.url === pathToFileURL(process.argv[1]).href` (ESM) or `require.main === module` (CJS).

**Fix:** consolidate to 2 patterns: one for `workers/index.ts` and one for `workers/index.js`. Use `path.sep` for the separator.

### 2.10 [P1] `injectedClock` is passed but not always used

**File:** `web/src/server/workers/index.ts` (throughout)

The `injectedClock` parameter is passed to every scheduled task but most jobs use `clock.now()` directly (imported from `@/lib/clock`). The injection is meant to support tests with a fake clock, but it's only honored in some places.

**Fix:** audit each job for direct `clock.now()` calls. Replace with the injected clock.

### 2.11 [P2] `activeJobs` is a `Set<Promise<any>>` — not a Set of job IDs

**File:** `web/src/server/workers/index.ts:194, 248-253, 352-362`

```ts
const activeJobs = new Set<Promise<any>>();
...
const promise = processor(job);
activeJobs.add(promise);
try {
  await promise;
} finally {
  activeJobs.delete(promise);
}
```

The set tracks in-flight promises, not job IDs. On shutdown, `Promise.all(Array.from(activeJobs))` waits for all to complete. **This works** but `activeJobs.size` is the only visible state. A monitoring endpoint that shows "active jobs" can't tell which jobs.

**Fix:** add a `Map<jobId, Promise<any>>` for tracking. Expose via a `/api/internal/jobs/active` endpoint.

### 2.12 [P0] `handleShutdown` exits with code 0 even if shutdown timed out

**File:** `web/src/server/workers/index.ts:354-366`

```ts
const shutdownTimeout = new Promise((resolve) => setTimeout(resolve, 30000));
await Promise.race([Promise.all(Array.from(activeJobs)), shutdownTimeout]);
if (activeJobs.size > 0) {
  logger.warn(`[Workers] Graceful shutdown timed out. ${activeJobs.size} jobs still in-flight.`);
} else {
  logger.info('[Workers] All in-flight jobs completed successfully');
}
process.exit(0);
```

After timeout, `process.exit(0)` returns 0 (success). **A k8s liveness probe interprets this as a healthy shutdown.** But jobs are still in-flight and may have left the DB in an inconsistent state.

**Fix:** on timeout, `process.exit(1)` (failure). Add a final attempt to mark in-flight jobs as failed.

---

## 3. Outbox + JobQueue + Idempotency library

### 3.1 [P0] `OutboxService.emit` is called WITHOUT a transaction in most production code paths

**File:** `web/src/server/workers/outbox.ts:83-107`

```ts
async emit(
  eventType: OutboxEventType,
  payload: Record<string, unknown>,
  maxAttempts = 3,
  tx?: Prisma.TransactionClient
): Promise<string> {
  const client = tx || db;
  try {
    const event = await client.outboxEvent.create({
      data: {
        eventType,
        payload: JSON.stringify(payload),
        status: 'PENDING',
        maxAttempts,
      },
      select: { id: true },
    });
    ...
  }
}
```

The function accepts an optional `tx` parameter for transactional use. But:
- `OutboxEventTypes.WALLET_TOPUP_APPROVED` is emitted by wallet use-cases — **without** `tx`. If the use-case writes a `Transaction` and then emits an outbox event, the two are NOT in a transaction. **A crash between the two writes loses the event.**
- The atomicity guarantee of the outbox pattern requires that the originating write and the outbox event are in the same transaction.

**Audit question:** verify the wallet use-cases pass `tx` to `OutboxService.emit`. If they don't, this is a P0.

### 3.2 [P0] `JobQueue.enqueue` does NOT take a `tx` parameter

**File:** `web/src/lib/job-queue.ts:30-53`

```ts
async enqueue(
  type: string,
  payload: Record<string, unknown>,
  _delayMs = 0,
  maxAttempts = 3
): Promise<string> {
  try {
    const event = await db.outboxEvent.create({
      data: { eventType: type, payload: JSON.stringify(payload), status: 'PENDING', maxAttempts },
      select: { id: true },
    });
    ...
  }
}
```

`JobQueue.enqueue` does NOT accept a transaction client. So the use-case layer cannot enqueue atomically with the originating write via `JobQueue`. The `OutboxService.emit` accepts `tx`, but `JobQueue.enqueue` does not. **Inconsistent API.**

**Fix:** add `tx?: Prisma.TransactionClient` to `JobQueue.enqueue`. Migrate callers.

### 3.3 [P0] `JobQueue.processJobs` is racy — multiple worker instances can process the same event

**File:** `web/src/lib/job-queue.ts:66-92`

The claim query uses `FOR UPDATE SKIP LOCKED` (line 89), which is the standard pattern. **But:** the `UPDATE` is followed by a `RETURNING` of the updated rows. The `SELECT` inside the subquery uses `FOR UPDATE SKIP LOCKED`, but the outer `UPDATE` doesn't take the same lock semantics.

In Postgres, `UPDATE ... WHERE id IN (SELECT ... FOR UPDATE SKIP LOCKED)` is atomic within the statement. Two concurrent invocations of `processJobs` will see different `id`s. **This is correct** — the `FOR UPDATE SKIP LOCKED` works as expected. **No fix needed.**

### 3.4 [P1] `JobQueue.processJobs` uses `db.$queryRaw` — bypasses the soft-delete extension

**File:** `web/src/lib/job-queue.ts:66-92`

The raw query bypasses the Prisma extension in `db.ts:247-338` that enforces soft-delete. The `OutboxEvent` model is not in the `softDeleteModels` list (per `db.ts:263-270`), so the bypass is OK. **But:** the raw query is not wrapped in any extension, so future changes to the extension won't affect this query. This is fragile.

**Fix:** add a comment explaining the bypass is intentional.

### 3.5 [P1] `JobQueue.processJobs` `attempts` is incremented twice on success

**File:** `web/src/lib/job-queue.ts:111-119`

```ts
// Mark as COMPLETED
await db.outboxEvent.update({
  where: { id: event.id },
  data: {
    status: 'COMPLETED',
    processedAt: clock.now(),
    attempts: { increment: 1 },
    readyAt: null,
  },
});
```

The `attempts: { increment: 1 }` runs on success. **But the claim query (line 78-91) doesn't increment attempts** — the row is claimed with `status = 'PROCESSING'` but the same `attempts` value as before. So:
- Job created with `attempts: 0`
- First claim: `attempts: 0`, processed, marked COMPLETED with `attempts: 1`
- Second claim (retry): `attempts: 1`, processed, marked COMPLETED with `attempts: 2`

The `attempts` counter represents the number of attempts, including the successful one. **This is OK semantically** (the counter says "I tried once"), but the error path (line 122-135) ALSO increments attempts. So a failed-then-retried-then-successful event ends with `attempts: 3`, not `attempts: 2`. **Inconsistent.**

**Fix:** increment attempts only on failure (when the backoff is applied). On success, don't increment — `attempts` should represent failed attempts, with `processedAt` indicating success.

### 3.6 [P0] `JobQueue.processJobs` has the `Promise.allSettled` pattern — but the events are processed **sequentially** in the loop, not in parallel

**File:** `web/src/lib/job-queue.ts:96-149`

```ts
await Promise.allSettled(
  pending.map(async (event: any) => {
    try {
      ...
      await processor(job);
      await db.outboxEvent.update({ ... });
    } catch (err) {
      await db.outboxEvent.update({ ... });
    }
  })
);
```

`Promise.allSettled` runs all the mapped promises concurrently. **So events are processed in parallel within a single `processJobs` call, with the count capped at `concurrency` (per the `LIMIT concurrency` in the claim query).** OK, this is correct.

**But:** the comment in the audit summary (`index.ts:38-46`) says `concurrency: 5` for `SMS_SEND`, which means 5 SMS are sent in parallel. **No rate limit** on the SMS provider.

### 3.7 [P1] `JobQueue.processJobs` doesn't catch errors in the `db.outboxEvent.update` (mark COMPLETED) call

**File:** `web/src/lib/job-queue.ts:111-119`

If the COMPLETED update fails (e.g. DB connection drop after the job ran), the job is **lost**: the event remains in `PROCESSING` until the reaper reclaims it. **The work is done (the SMS was sent, the notification was dispatched) but the event is not marked COMPLETED.** On reaper reclaim, the job is retried, and the SMS is sent twice.

**Fix:** wrap the COMPLETED update in a try/catch. If the update fails, log it and re-throw to be caught by the reaper.

### 3.8 [P1] `JobQueue.runReaper` reclaims events from `PROCESSING` to `PENDING` — but doesn't reset `attempts`

**File:** `web/src/lib/job-queue.ts:157-175`

```ts
async runReaper(): Promise<number> {
  const cutoff = new Date(clock.now().getTime() - 5 * 60 * 1000);
  const result = await db.outboxEvent.updateMany({
    where: {
      status: 'PROCESSING',
      updatedAt: { lt: cutoff },
    },
    data: {
      status: 'PENDING',
      error: 'Reclaimed by reaper — stuck in PROCESSING',
    },
  });
  ...
}
```

The reaper resets `status: 'PENDING'` but does NOT reset `attempts`. So a job that has been retried 2 times then stuck in PROCESSING, when reclaimed, has `attempts: 2`. **The next attempt is the 3rd (final), and if it fails, the job is marked FAILED — but the work that already happened may not be undone.**

**Fix:** reset `attempts` to 0 on reaper reclaim. Or, document the trade-off.

### 3.9 [P0] `JobTypes` enum in `lib/job-queue.ts:217-224` is stale

**File:** `web/src/lib/job-queue.ts:217-224`

```ts
export const JobTypes = {
  SEND_SMS: 'sms.send',
  SEND_EMAIL: 'send_email',         // No worker for this
  NOTIFICATION: 'notification.send',
  RIDE_REMINDER: 'ride_reminder',  // Stale name (was probably 'rent_reminder')
  REFERRAL_REWARD: 'referral.reward',
  REFUND_PROCESSING: 'refund_processing',  // No worker for this
};
```

This enum has **stale entries**: `SEND_EMAIL` and `REFUND_PROCESSING` have no consumers, and `RIDE_REMINDER` looks like an old name. The canonical enum is `OutboxEventTypes` in `outbox.ts:35-71` (re-exported as `JOB_TYPES` in `queues.ts:13`). **The `JobTypes` here is a duplicate, drift-prone.**

**Fix:** delete `JobTypes` or mark as deprecated. The canonical source is `OutboxEventTypes`.

### 3.10 [P1] `idempotency.ts` has both an in-memory `Map` and a DB table

**File:** `web/src/lib/idempotency.ts:9-23`

```ts
const memoryStore = new Map<string, IdempotencyEntry>();
...
setInterval(() => { ... }, 10 * 60 * 1000);
```

The `memoryStore` is a fallback for when the DB is down. **But:** the `checkOrClaimIdempotency` function (line 49-65) uses `db.$executeRawUnsafe` to insert into the DB. If the DB is down, the function throws. The in-memory `memoryStore` is never used by the canonical flow. **Dead code.**

**Fix:** delete the `memoryStore` and the `setInterval`. Use the DB only.

### 3.11 [P0] `idempotency.ts:91-99` has a `const` declaration inside a `case` without braces — the `parsed` variable is hoisted

**File:** `web/src/lib/idempotency.ts:91-99`

```ts
switch (row.status) {
  case 'COMPLETED':
    const parsed = tryParseResponse(row.response);
    if (parsed !== null) {
      return { status: 'completed', response: parsed };
    }
    // Corrupted response — fall through
    logger.warn('[Idempotency] Corrupted response, returning processing', { key });
    return { status: 'processing' };
```

The `const parsed` is inside a `case` without braces, which causes a `no-case-declarations` ESLint warning. The `parsed` is scoped to the switch block (due to `const`), but the case is fall-through. **The warning is the only issue** — the code works correctly. **Fix:** wrap the case in braces: `case 'COMPLETED': { const parsed = ...; ... }`.

### 3.12 [P1] `idempotency.ts:88` recursive call to `checkOrClaimIdempotency` after deleting an expired key

**File:** `web/src/lib/idempotency.ts:88`

```ts
if (row.expiresAt.getTime() <= Date.now()) {
  await db.idempotencyKey.delete({ where: { key } }).catch(() => {});
  memoryStore.delete(key);
  return checkOrClaimIdempotency(key, ttlSeconds);  // Recursive call
}
```

The recursion can stack-overflow if the key is repeatedly inserted with a past `expiresAt` (e.g. a bug in the producer). **Fix:** use a loop with a max iteration count (e.g. 3).

### 3.13 [P0] `idempotency.ts:60-65` raw SQL uses `$1`, `$2` placeholders — but `$executeRawUnsafe` is used

**File:** `web/src/lib/idempotency.ts:59-65`

```ts
const inserted = await db.$executeRawUnsafe(
  `INSERT INTO "IdempotencyKey" (id, key, status, response, "expiresAt", "createdAt")
   VALUES (gen_random_uuid()::text, $1, 'PROCESSING', NULL, $2, NOW())
   ON CONFLICT (key) DO NOTHING`,
  key,
  expiresAt
);
```

`$executeRawUnsafe` accepts a parameterized query with `$1`, `$2` placeholders. **The key is passed as a parameter, not interpolated.** This is safe from SQL injection. **Good.**

But the `id` is `gen_random_uuid()::text` — assumes the Postgres `pgcrypto` extension is enabled. **Verify the migration that creates the `idempotency_keys` table enables `pgcrypto`.** Looking at the migration history, the 0_init migration does NOT enable it.

**Fix:** verify `pgcrypto` is enabled, or use `cuid()` (Prisma's default) in the INSERT.

### 3.14 [P1] `idempotency.ts:111` re-reads after delete — race condition

**File:** `web/src/lib/idempotency.ts:79-82`

```ts
if (!row) {
  return { status: 'processing' };
}
```

After `INSERT ... ON CONFLICT DO NOTHING`, the function reads the existing row. **If the row is deleted between the INSERT and the SELECT (e.g. by a reaper), the function returns 'processing'.** The caller (e.g. the route) returns 409. **This is a transient error — the caller should retry.** The current code doesn't communicate "retry" to the caller.

**Fix:** add a `retryAfterMs: number` field to the result. Or, document the behavior.

---

## 4. Job-by-job audit

### 4.1 [P0] `wallet-reconciliation.job.ts` (broad audit referenced)

**File:** `web/src/server/workers/jobs/wallet-reconciliation.job.ts:37-84`

The previous broad audit flagged this for being non-concurrent-safe. The deeper finding:

```ts
for (const wallet of wallets) {
  const integrity = await verifyLedgerIntegrity(db, wallet.riderId);
  ...
}
```

The job iterates all wallets sequentially. For 100k wallets, this is 100k sequential DB roundtrips. **With a 10ms roundtrip per wallet, that's 1000 seconds (~17 min).** The job runs in a single transaction-less loop, so a crash mid-loop leaves the report incomplete.

Also: the result is returned but **never written to `ReconciliationReport`**. The function returns `ReconciliationResult` and the `recordReconciliation` function (line 86-100) writes to the audit log, but **does not create a `ReconciliationReport` row**. So the table stays empty.

**Fix:** 
1. Write the result to `ReconciliationReport` in the same job
2. Use `Promise.all` with a bounded concurrency (e.g. 10) for parallel integrity checks
3. Add a `processedAt` and `totalDurationMs` to the report

### 4.2 [P0] `reconciliation.job.ts` — the OTHER reconciliation job (duplicates wallet-reconciliation.job.ts)

**File:** `web/src/server/workers/jobs/reconciliation.job.ts` (140 lines)

This is a **second** reconciliation job, separate from `wallet-reconciliation.job.ts`. The two are inconsistent:
- `wallet-reconciliation.job.ts` calls `verifyLedgerIntegrity` from `lib/services/wallet-service.ts:415-450` (excludes SECURITY_DEPOSIT, FORFEITURE, REFUND).
- `reconciliation.job.ts:62-73` inlines the same logic but with a different exclusion list (`{ notIn: ['SECURITY_DEPOSIT', 'FORFEITURE', 'REFUND'] }` — same).

Both produce the same result. **The two jobs are duplicates.** Only one is wired to a worker (`reconciliationJob.process` in `index.ts:50-53`, on `OutboxEventTypes.WALLET_RECONCILIATION`).

**Why both exist:** `wallet-reconciliation.job.ts` is the broad-audit referenced job (probably the older one). `reconciliation.job.ts` is the outbox-driven version (newer). **The old one is dead code.**

**Fix:** delete `wallet-reconciliation.job.ts`. The audit reference in `wallet-service.ts` should be updated.

### 4.3 [P1] `reconciliation.job.ts:23-36` idempotency check is racy

**File:** `web/src/server/workers/jobs/reconciliation.job.ts:23-36`

```ts
const existingReport = await db.reconciliationReport.findUnique({
  where: { reportDate: today },
});
if (existingReport) {
  logger.info('[ReconciliationJob] Already ran today', { date: today });
  return { ... };
}
```

Two concurrent job invocations can both pass the `findUnique` check before either writes the report. **Race condition.** The `ReconciliationReport.reportDate` is `@unique`, so the second `create` will fail with a unique constraint violation. But the failure is uncaught and bubbles up to the worker, which retries with backoff.

**Fix:** use the `IdempotencyKey` table (per `idempotency.ts:49`) instead of a custom check. The `INSERT ... ON CONFLICT DO NOTHING` is atomic.

### 4.4 [P0] `reconciliation.job.ts:40-44` backfill loop is unbounded and runs in serial

**File:** `web/src/server/workers/jobs/reconciliation.job.ts:40-44`

```ts
const allRiderIds = await db.wallet.findMany({ select: { riderId: true } });
for (const { riderId } of allRiderIds) {
  await backfillOpeningBalance(db, riderId).catch((err: Error) => {
    logger.error('[ReconciliationJob] backfill error', { riderId, err });
  });
}
```

The backfill is per-wallet, sequentially. For 100k wallets, this is 100k sequential calls. **No batching.** The `backfillOpeningBalance` function (per `wallet-service.ts:461-489`) creates a `WalletLedger` entry, which is an INSERT. The unindexed lookup of `idempotencyKey` (line 469) is an extra query per wallet.

**Fix:** batch the backfill. Use `createMany` for the ledger entries, after a single query to find wallets that need backfill.

### 4.5 [P0] `reconciliation.job.ts:62-90` per-wallet ledger sum is N+1

**File:** `web/src/server/workers/jobs/reconciliation.job.ts:62-90`

```ts
for (const wallet of wallets) {
  const entries = await db.walletLedger.findMany({
    where: { walletId: wallet.id, category: { notIn: ['SECURITY_DEPOSIT', 'FORFEITURE', 'REFUND'] } },
    select: { entryType: true, amountInPaise: true },
  });
  ...
}
```

For 100k wallets, this is 100k separate `findMany` queries. **N+1 anti-pattern.** A single aggregation query could compute the sum per wallet in one roundtrip:

```sql
SELECT wallet_id, 
       SUM(CASE WHEN entry_type = 'CREDIT' THEN amount_in_paise ELSE -amount_in_paise END) AS sum
FROM wallet_ledgers
WHERE category NOT IN ('SECURITY_DEPOSIT', 'FORFEITURE', 'REFUND')
GROUP BY wallet_id;
```

**Fix:** replace the per-wallet loop with a single aggregation.

### 4.6 [P1] `reconciliation.job.ts:114-121` mismatch alert is fire-and-forget

**File:** `web/src/server/workers/jobs/reconciliation.job.ts:114-121`

```ts
await OutboxService.emit(OutboxEventTypes.ADMIN_ACTION, {
  action: 'reconciliation.mismatch_alert',
  reportDate: today,
  mismatched,
  totalDrift: totalWalletSum - totalLedgerSum,
}).catch(() => {});
```

The `.catch(() => {})` swallows the emit error. **If the outbox event write fails, no alert is sent.** The mismatch is logged (line 108) but no operator is notified.

**Fix:** log the error, don't swallow. Or, send a separate alert (email/SMS/Slack).

### 4.7 [P0] `notification-dispatch.job.ts:147-180` overlay trigger has no FCM-error retry

**File:** `web/src/server/workers/jobs/notification-dispatch.job.ts:172-178`

```ts
await fcmService
  .sendOverlayTrigger(rider.fcmToken, payload.type, extra)
  .catch((err: Error) =>
    logger.warn('[NotificationDispatch] FCM overlay failed', {
      err: (err instanceof Error ? err.message : String(err)),
    })
  );
return { delivered: true, channel: 'overlay' };
```

The FCM error is caught and logged, but the function returns `{ delivered: true, ... }` — **claiming success even though the FCM call failed**. The `OutboxEvent` is marked COMPLETED, but the rider never got the overlay.

**Fix:** if FCM fails, throw so the event is retried (per `JobQueue.processJobs` error path).

### 4.8 [P1] `notification-dispatch.job.ts:88-194` switch has 13 cases — God Object

**File:** `web/src/server/workers/jobs/notification-dispatch.job.ts:88-194`

A single 100+ line `switch` statement with 13 cases, each calling a different `notificationService` method. The cases are similar but not identical. **Code smell.**

**Fix:** refactor to a `NotificationRouter` with a per-type handler map. Each handler is a function `(payload) => Promise<DispatchResult>`.

### 4.9 [P1] `notification-dispatch.job.ts:42-56` `NotificationPayloadType` enum is hand-maintained

**File:** `web/src/server/workers/jobs/notification-dispatch.job.ts:42-56`

```ts
export type NotificationPayloadType =
  | 'KYC_APPROVED'
  | 'KYC_REJECTED'
  | 'KYC_INFO_REQUIRED'
  ...
```

The type is hand-maintained. **Adding a new notification type requires updating this enum, the `switch` in `process()`, and likely a `notificationService` method.** Drift-prone.

**Fix:** generate the type from a single source of truth (a JSON config or a code-generated file).

### 4.10 [P0] `notification-dispatch.job.ts` — `KYC_APPROVED` doesn't pass `reason`

**File:** `web/src/server/workers/jobs/notification-dispatch.job.ts:88-94`

```ts
case 'KYC_APPROVED':
  await notificationService.notifyKycStatusChange(
    payload.riderId,
    'APPROVED'
  );
  return { delivered: true, channel: 'fcm' };
```

The KYC `APPROVED` case doesn't pass a reason. The `KYC_REJECTED` and `KYC_INFO_REQUIRED` cases do. **Inconsistent.** The KYC_APPROVED notification may want to include a "Welcome to Voltium" message.

**Fix:** pass a reason consistently (or explicitly document why APPROVED has no reason).

### 4.11 [P0] `daily-engagement.job.ts:60-128` — `try` block scope issue with `results` and `completeIdempotency`

**File:** `web/src/server/workers/jobs/daily-engagement.job.ts:60-128`

The structure is:
```
try {
  const results = { ... };
  // ... operations
  await completeIdempotency(idempotencyKey, results).catch(() => {});
  return results;
} catch (err) {
  await failIdempotency(idempotencyKey).catch(() => {});
  throw err;
}
```

The `results` is built up by 3 sequential operations (birthdays, paymentReminders, referralLeaderboard). Each operation uses `.catch()` to swallow per-rider errors but increments the result counter. **If an operation throws synchronously (e.g. `db.rider.findMany` fails), the catch block fires and `results` is incomplete — but the `completeIdempotency` was never called.** The next day, the idempotency key is different, so the job re-runs. But the **incomplete `results` is lost** — the audit log shows "0 birthdays, 0 reminders, 0 leaderboard" when in fact 50 of 100 reminders were sent.

**Fix:** log the partial result before re-throwing. Or, track success/failure per operation and log.

### 4.12 [P1] `daily-engagement.job.ts:68-70` birthday detection uses `startsWith` on the DOB string

**File:** `web/src/server/workers/jobs/daily-engagement.job.ts:68-70`

```ts
const [, mm, dd] = istDateKey.split('-');
const birthdayString = `${dd}-${mm}`;
const birthdayRiders = await db.rider.findMany({
  where: { dob: { startsWith: birthdayString } },
  ...
});
```

The `Rider.dob` is `String?` and per `seed.ts:11` is stored as "DD-MM-YYYY" format. The `startsWith: 'dd-mm'` matches correctly. **But:** if a rider's `dob` is stored as "1-1-1990" (single digit) instead of "01-01-1990", the startsWith fails. **Inconsistent format.**

**Fix:** normalize the DOB at write time to "DD-MM-YYYY". Add a migration to fix existing data.

### 4.13 [P1] `daily-engagement.job.ts:88-91` payment reminder uses `lifecycleStatus: 'ACTIVE'` but the query is `wallet: { balanceInPaise: { lt: 0 } }`

**File:** `web/src/server/workers/jobs/daily-engagement.job.ts:88-91`

```ts
const ridersToRemind = (await db.rider.findMany({
  where: { lifecycleStatus: 'ACTIVE', wallet: { balanceInPaise: { lt: 0 } } },
  ...
})) as Array<{ id: string; wallet?: { balanceInPaise: number } | null }>;
```

A rider with negative balance gets a reminder. **But:** the `Wallet.balanceInPaise` is `Int` and a CHECK constraint (recommended in `AUDIT_DATABASE.md`) would prevent negative balances. The reminder logic implies negative balance is allowed, but the DB doesn't enforce it. **Mismatch.**

**Fix:** clarify the business rule. Either allow negative balance (with overdraft logic) or treat `lt: 0` as `lt: 100` (low balance).

### 4.14 [P0] `rent-reminders.job.ts:65-86` auto-debit is in a transaction but the rental state is NOT updated

**File:** `web/src/server/workers/jobs/rent-reminders.job.ts:65-86`

```ts
await db.$transaction(async (tx: any) => {
  const txn = await tx.transaction.create({ ... });
  await walletLedgerService.debit({ ... }, tx);
});

createAuditLog({ ... }).catch(() => {});

result.autoDebited++;

// Send payment receipt notification
await notificationService.notifyPaymentReminder(rider.id, rentAmount, 'payment_receipt')
  .catch(() => {});
```

The transaction creates a `Transaction` and a `WalletLedger` entry. **But the `RentalLease.status` is NOT updated from `BOOKED` to `ACTIVE` or `COMPLETED`.** The lease is still in `BOOKED` state, and the next day's run will pick it up again and try to debit again. **Double-charge risk.**

**Fix:** update the `RentalLease.status` to `ACTIVE` (or `COMPLETED` if the rent covers the full lease) inside the transaction.

### 4.15 [P0] `rent-reminders.job.ts:31-50` query selects BOOKED leases with `leaseDate: { lte: today }` — includes future-dated leases

**File:** `web/src/server/workers/jobs/rent-reminders.job.ts:31-39`

```ts
const activeLeases = (await db.rentalLease.findMany({
  where: {
    status: 'BOOKED',
    leaseDate: { lte: today },
    rider: { lifecycleStatus: 'ACTIVE', wallet: { balanceInPaise: { gte: 0 } } },
  },
  ...
```

`leaseDate: { lte: today }` matches leases from today and earlier. The `BOOKED` status implies the lease hasn't started yet. **But:** for leases with a future `leaseDate`, the rent is not due until that date. The query correctly excludes them (they have `leaseDate: gt: today`).

**But the query includes leases with `leaseDate: lte: today` AND `status: 'BOOKED'`.** A lease from yesterday is still BOOKED. The job tries to debit. **What if the rider was already debited yesterday?** No tracking of "already paid" — the `Transaction` and `WalletLedger` have the idempotency key `rent:${lease.id}:${today}` (line 63), which prevents double-debit for the same lease on the same day. **But across multiple days, the lease stays BOOKED and the rent is debited each day.**

**Fix:** the `rentalLease` should have a `lastDebitAt` field, or the job should be per-lease-day (not per-day-for-all-leases).

### 4.16 [P1] `rent-reminders.job.ts:32` `status: 'BOOKED'` is wrong — should be `ACTIVE` for due rent

**File:** `web/src/server/workers/jobs/rent-reminders.job.ts:32`

The query filters `status: 'BOOKED'`. A BOOKED lease is one that hasn't started yet. Once started, the status moves to `ACTIVE`. **The query for "rent due" should be on `status: 'ACTIVE'` or include both `BOOKED` and `ACTIVE`.**

**Fix:** clarify the business rule. If rent is debited when the lease is BOOKED, the state should be ACTIVE by the time rent is due.

### 4.17 [P0] `device-compliance.job.ts:48-65` per-rider check is N+1

**File:** `web/src/server/workers/jobs/device-compliance.job.ts:23-90`

```ts
for (const rider of activeRiders) {
  ...
  if (missingPermissions.length > 0) {
    for (const permissionId of missingPermissions) {
      const existing = await db.deviceViolation.findFirst({ ... });
      if (!existing) {
        await db.deviceViolation.create({ ... });
      }
    }
    ...
  }

  const oldViolations = await db.deviceViolation.updateMany({ ... });
  ...
}
```

For each active rider (potentially 100k), 2-3 DB calls. **N+1.** The `findFirst` and `create` could be batched. The `updateMany` at the end is per-rider (could be one global update).

**Fix:** batch the violations into a single `createMany`. Run the global `updateMany` for old violations outside the loop.

### 4.18 [P1] `device-compliance.job.ts:40-42` only checks `isLocationMandatory && deviceViolationCount > 0` — never re-evaluates

**File:** `web/src/server/workers/jobs/device-compliance.job.ts:40-42`

```ts
if (rider.isLocationMandatory && rider.deviceViolationCount > 0) {
  missingPermissions.push('location');
}
```

The check is for `deviceViolationCount > 0`. But the `deviceViolationCount` is updated by the `rider/device` API on the rider's phone, not by this job. **If the count is stale (e.g. the API updates the count but the job runs on a snapshot), the check is wrong.**

Also, only `location` is checked. The other permissions (`battery`, `contacts`, `callLogs`, `mic`, `camera`, `phone`) are not checked. **Incomplete coverage.**

**Fix:** check all mandatory permissions against actual device state (from the latest `userLocation`, `userCallLog`, etc.).

### 4.19 [P0] `referral-reward.job.ts:33-43` is a money path with no idempotency on the reward itself

**File:** `web/src/server/workers/jobs/referral-reward.job.ts:33-43`

```ts
const idempotencyKey = `referral:${referrer.id}:${referredRiderId}`;

try {
  await db.$transaction(async (tx: any) => {
    const txn = await tx.transaction.create({ ... });
    await walletLedgerService.credit({ ... }, tx);
    await tx.reward.create({ ... });
  });
  ...
}
```

The `idempotencyKey` is set on the `WalletLedger` entry, not on the `Transaction` or `Reward`. **If the job is retried mid-transaction, the `WalletLedger` check on idempotency prevents the credit. But the `Transaction` and `Reward` rows may be created twice (one in the original attempt, one in the retry).** Because the entire block is in a `db.$transaction`, this is OK — the transaction rolls back on failure. **But the outbox event is emitted AFTER the transaction commits (line 91-95).** If the outbox emit fails, the reward is granted but the notification is lost.

**Fix:** move the outbox emit INSIDE the transaction (using the `tx` parameter).

### 4.20 [P1] `referral-reward.job.ts:46` `REWARD_AMOUNT_PAISE = 10000` is hardcoded

**File:** `web/src/server/workers/jobs/referral-reward.job.ts:46`

The reward amount is hardcoded as `10000` paise (₹100). **Verify the referral use-case passes a different amount if it varies.** The `referral.use-cases.ts` may have a configurable reward.

**Fix:** read the reward amount from a `SystemSetting` (`'referralBonus'`) or pass via the job payload.

### 4.21 [P0] `audit-cleanup.job.ts:24-30` calls `deleteExpiredLogs` from `lib/audit-log.ts` — but doesn't return the count

**File:** `web/src/server/workers/jobs/audit-cleanup.job.ts:24-30`

```ts
const count = await deleteExpiredLogs();
await completeIdempotency(idempotencyKey, { expiredLogsDeleted: count }).catch(() => {});
```

`deleteExpiredLogs` returns the count. **The job passes the count to `completeIdempotency`** which writes it to the `IdempotencyKey.response` column. But the job's `process()` return value is `AuditCleanupResult` which is `expiredLogsDeleted: number`. The return value is the same as the `completeIdempotency` payload. **No issue, just redundant.**

The actual issue: `deleteExpiredLogs` is in `lib/audit-log.ts`. Need to verify it has a row-count cap (e.g. max 10k per call) to avoid long-running deletes. **Verify.**

### 4.22 [P1] `audit-cleanup.job.ts:18` idempotency key uses local date, not UTC

**File:** `web/src/server/workers/jobs/audit-cleanup.job.ts:16-18`

```ts
const today = clock.now().toISOString().split('T')[0];
const idempotencyKey = `audit-cleanup:daily:${today}`;
```

`clock.now().toISOString()` is UTC. The `idempotencyKey` is the UTC date. If the server is in IST (UTC+5:30), the UTC date is 5:30 hours behind the IST date. **A 23:00 IST run uses tomorrow's UTC date, and the 06:00 IST run uses yesterday's UTC date.** The idempotency key may collide with the next day's run.

**Fix:** use IST date (per `daily-engagement.job.ts:44-49`). Or, accept the UTC date but document the behavior.

### 4.23 [P0] `telemetry-cleanup.job.ts:26-32` deletes telemetry without audit log

**File:** `web/src/server/workers/jobs/telemetry-cleanup.job.ts:25-32`

```ts
const [locationsDeleted, callLogsDeleted, contactsDeleted] = await Promise.all([
  db.userLocation.deleteMany({ where: { timestamp: { lt: thirtyDaysAgo } } }),
  db.userCallLog.deleteMany({ where: { timestamp: { lt: thirtyDaysAgo } } }),
  db.userContact.deleteMany({ where: { createdAt: { lt: thirtyDaysAgo } } }),
]);
```

The `UserLocation`, `UserCallLog`, `UserContact` are PII tables (per `AUDIT_DATABASE.md` 11.x). **Deleting PII without an audit log is a GDPR concern.** A rider's data is deleted, but no record of when, how many, by whom.

**Fix:** create an `AuditLog` entry with `action: 'CLEANUP'`, `entity: 'userLocation'` etc. before the delete.

### 4.24 [P1] `telemetry-cleanup.job.ts:31` uses `createdAt` for `UserContact` but `timestamp` for the others

**File:** `web/src/server/workers/jobs/telemetry-cleanup.job.ts:29-31`

Inconsistent: `UserLocation.timestamp` vs `UserContact.createdAt`. The `timestamp` is the location reading time; the `createdAt` is when the row was inserted. **For a rider who hasn't opened the app in 30 days, the `createdAt` is from 30 days ago but the `timestamp` is also from 30 days ago.** Same in practice. But the semantic is different.

**Fix:** standardize on `createdAt` for all three, or document the rationale.

### 4.25 [P0] `notifications-cleanup.job.ts:6-17` deletes read notifications without audit log

**File:** `web/src/server/workers/jobs/notifications-cleanup.job.ts:5-17`

Same as 4.23 — deletes PII-adjacent data (notifications may contain PII like "Your deposit of ₹5000 was approved for ${fullName}") without audit log.

**Fix:** add audit log.

### 4.26 [P0] `notifications-cleanup.job.ts:5-6` is not wired to any worker in `index.ts`

**File:** `web/src/server/workers/jobs/notifications-cleanup.job.ts`, `web/src/server/workers/index.ts`

The job is exported but **not imported by `index.ts`**. The `WORKERS` array (line 47-104) and `SCHEDULED_TASKS` array (line 110-170) don't reference `notificationsCleanupJob`. **The job is dead code.** Notifications older than 30 days are never deleted.

**Fix:** wire to `SCHEDULED_TASKS` (every 24 hours).

### 4.27 [P0] `notifications.job.ts` is the deprecated tombstone — but still referenced in `index.ts` (or is it?)

**File:** `web/src/server/workers/jobs/notifications.job.ts:1-86`, `web/src/server/workers/index.ts:28-33`

The `index.ts` has a comment (line 28-32) saying the file is a tombstone and should be deleted. **But the file is still in the tree.** Verify the file is not imported anywhere else (e.g. by the `WORKERS` array, the `SCHEDULED_TASKS` array, or a test).

**Fix:** delete the file in the next cleanup pass. Verify no other file imports `notificationsJob` (other than tests).

### 4.28 [P0] `scheduled-backup.job.ts:36-39` race condition on "is a backup running" check

**File:** `web/src/server/workers/jobs/scheduled-backup.job.ts:36-39`

```ts
const running = await backupRepository.findRunningBackup();
if (running) {
  return { ran: false, reason: 'A backup is already in progress' };
}
```

The check is "find any backup with status IN ('PENDING', 'RUNNING')". **Race condition:** between the `findRunningBackup` and the new `BackupJob.create`, another worker process can create a backup. Two scheduled backups run simultaneously.

**Fix:** use the same atomic claim pattern as the outbox: `INSERT ... ON CONFLICT DO NOTHING`. Or, use a Postgres advisory lock.

### 4.29 [P0] `scheduled-backup.job.ts:163-171` FCM failure alert is fire-and-forget

**File:** `web/src/server/workers/jobs/scheduled-backup.job.ts:163-171`

```ts
await fcmService
  .sendPushNotification('/topics/admin_alerts', 'Backup Failed 🚨', `Scheduled backup failed: ...`)
  .catch((fcmErr) => {
    logger.error('[ScheduledBackup] Failed to send FCM alert', { error: fcmErr.message });
  });
```

The FCM alert is the only operator notification. **If FCM fails (e.g. no subscribers, network error), no operator is notified.** A backup failure goes silent.

**Fix:** add email/SMS/Slack as a backup alert channel. Or, use a dedicated alerting system.

### 4.30 [P1] `scheduled-backup.job.ts:42-51` reads `MAINTENANCE_MODE` and `BACKUP_LOCK_STATUS` from `SystemSetting`

**File:** `web/src/server/workers/jobs/scheduled-backup.job.ts:42-51`

```ts
const maintenanceSetting = await db.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MODE' } });
if (maintenanceSetting?.value === 'true') { ... }
const backupLock = await db.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_STATUS' } });
if (backupLock?.value === 'RESTORE_RUNNING') { ... }
```

Two separate queries for two settings. **N+1.** Also, the `BACKUP_LOCK_STATUS` is a magic string — a typo elsewhere silently breaks the lock check.

**Fix:** use `db.systemSetting.findMany({ where: { key: { in: [...] } } })` for a single query. Or, define the keys as constants in a single module.

### 4.31 [P1] `scheduled-backup.job.ts:140-150` failure payload is stored as JSON string in `SystemSetting.value`

**File:** `web/src/server/workers/jobs/scheduled-backup.job.ts:140-150`

```ts
const failurePayload = JSON.stringify({ error: ..., at: ..., scheduleId: ... });
await db.systemSetting.upsert({
  where: { key: 'LAST_BACKUP_FAILURE' },
  update: { value: failurePayload },
  create: { key: 'LAST_BACKUP_FAILURE', value: failurePayload, valueType: 'STRING', category: 'INTERNAL', ... },
});
```

The `valueType: 'STRING'` is wrong — the value is JSON. **Should be `valueType: 'JSON'`.** Also, a single `SystemSetting` row holds the entire payload, which is hard to query (e.g. "all failures in the last 7 days"). **A dedicated `BackupFailure` table is cleaner.**

**Fix:** create a `BackupFailure` table with `scheduleId`, `error`, `at`, `resolved` columns. The `SystemSetting` becomes a cache.

### 4.32 [P1] `scheduled-backup.job.ts:54-66` disk-space check is on the local filesystem only

**File:** `web/src/server/workers/jobs/scheduled-backup.job.ts:54`

```ts
const freeBytes = await getFreeDiskBytes();
```

`getFreeDiskBytes()` is from `data-management/backup.service.ts`. The previous broad audit noted the local-storage-only setup. **In a multi-node setup, the disk space is per-node. A scheduled backup on node A may succeed while node B is out of space.**

**Fix:** make the disk check cluster-aware (e.g. via a shared metric).

---

## 5. Cross-cutting findings

### 5.1 [P0] `OutboxService.emit` is called WITHOUT a transaction in most use-cases

**File:** `web/src/server/workers/outbox.ts:83-107`, multiple use-case files

`OutboxService.emit` accepts an optional `tx` parameter. **But the API pattern is inconsistent:** some callers pass `tx`, some don't. The result is that the originating write and the outbox event are not atomic in many paths.

The previous broad audit flagged this in section 20.12. The deep finding: **the use-case layer needs a code-gen or lint rule that enforces the outbox emit is always inside a transaction.**

### 5.2 [P0] No DLQ (dead-letter queue) for permanently-failed events

**File:** `web/src/lib/job-queue.ts:128-136`

When an event reaches `attempts >= maxAttempts`, it's marked `FAILED`. **The event is then stuck in the `OutboxEvent` table forever.** No DLQ table, no admin UI to retry, no automatic archival.

**Fix:** add a `OutboxEventDLQ` table or move `FAILED` events to a `dlq` queue. Add admin UI to retry.

### 5.3 [P0] No alerting on failed events

**Pattern across all 12 jobs.**

When a job fails (transient or permanent), the only signal is a `logger.error` line. **No Slack/PagerDuty/email alert.** A failed `wallet-reconciliation` goes silent.

**Fix:** add a notification channel (Slack/email) on `attempts >= maxAttempts`. Or, add a `notifyOnFailure` flag per worker.

### 5.4 [P1] No job-level metrics (Prometheus)

**Pattern across all 12 jobs.**

The worker logs `info`/`warn`/`error` lines but doesn't emit Prometheus metrics. Hard to dashboard "which jobs are slow?" or "which jobs are failing?".

**Fix:** add a `metrics.ts` with `recordJobDuration(jobName, ms)`, `recordJobSuccess(jobName)`, `recordJobFailure(jobName, errorType)`.

### 5.5 [P0] Two reconciliation jobs exist (`wallet-reconciliation.job.ts` and `reconciliation.job.ts`)

**Pattern.**

Already covered in 4.1-4.2. The two are duplicates. **Delete the older `wallet-reconciliation.job.ts`.**

### 5.6 [P0] `notifications.job.ts` is a deprecated tombstone — but the file is still in the tree

**Pattern.**

Already covered in 4.27. **Delete the file in the next cleanup pass.**

### 5.7 [P1] `JobTypes` enum in `lib/job-queue.ts:217-224` is stale

Already covered in 3.9. **Delete `JobTypes` or mark deprecated.**

### 5.8 [P1] `idempotency.ts` has dead code (`memoryStore`)

Already covered in 3.10. **Delete the `memoryStore` and the `setInterval`.**

### 5.9 [P0] 10 of 20 OutboxEvent types are orphaned (no consumer)

Already covered in 1.2. **Audit each: is the event emitted for tracing only, or is it expected to be consumed?**

### 5.10 [P1] No concurrency limit on the worker process itself

**File:** `web/src/server/workers/index.ts:212-230`

The worker spawns 7 event-driven + 5 scheduled + 1 backup + 1 reaper = **14 concurrent loops** in a single Node process. With concurrency 1-5 per worker, the process can have 14 × 5 = 70 concurrent jobs at peak. **A single Node process with 70 concurrent DB queries is at risk of connection-pool exhaustion** (default pool size is 10 per `db.ts:170`).

**Fix:** 
1. Reduce per-worker concurrency
2. Or, run the worker as multiple Node processes
3. Or, increase the DB pool size (and connection limits on the server)

### 5.11 [P0] Worker has no startup-time env check

**File:** `web/src/server/workers/index.ts:198-230`

The worker starts without verifying that the DB is reachable, the `WORKER_SECRET` is set, or the required env vars are present. **A misconfigured worker silently fails to process jobs.**

**Fix:** add a startup check that pings the DB and validates env vars.

### 5.12 [P1] Worker has no health check endpoint

**Pattern.**

The worker process is a long-running process with no HTTP server. A k8s liveness probe can't check if the worker is healthy (e.g. processing events). **If the worker's event loop is stuck, k8s doesn't know.**

**Fix:** add a minimal HTTP server (e.g. on port 8082) that responds to `/healthz` with `{ status: 'ok', workers: [...], lastJobAt: ... }`.

### 5.13 [P0] Worker does not run as a separate process in `package.json`

**File:** `package.json` (need to verify)

The worker is meant to run as `npx tsx src/server/workers/index.ts`. **Verify there's a `npm run workers:start` script and a process manager (PM2, systemd, k8s) configured.**

### 5.14 [P1] Worker doesn't share connection pool with the Next.js app

**Pattern.**

The Next.js app and the worker both instantiate `db` from `@/lib/db`. **But the `db.ts` singleton is per-process.** The Next.js process has its own connection pool (10 conns); the worker has its own. **This is correct** but means a pool exhaustion in one doesn't affect the other.

**Fix:** monitor both pools. Add a `/api/health/db-pool` endpoint to both.

### 5.15 [P0] `OutboxEvent.payload` is `String` (JSON) — but no schema

**File:** `web/prisma/schema.prisma:947` (per `AUDIT_DATABASE.md` 13.x)

The `payload` is a JSON string with no schema. **A malformed payload (e.g. missing `riderId`) is accepted.** The job processor then has to defensively check.

**Fix:** add a JSONB column with a per-event-type schema. Or, use a code-generated validator per event type.

### 5.16 [P1] `OutboxEvent.attempts` and `maxAttempts` are separate fields, but the DB doesn't enforce `attempts <= maxAttempts`

**File:** `web/prisma/schema.prisma:949-950` (per `AUDIT_DATABASE.md` 13.x)

A bug in the worker can increment `attempts` past `maxAttempts`. **Fix:** add a CHECK constraint.

### 5.17 [P0] `OutboxEvent.payload` can be very large — no size cap

**File:** `web/prisma/schema.prisma:947`

The `payload` is `String` (no `@db.VarChar(...)`). **A bug in a use-case can write a 100MB payload.** This DoS's the queue.

**Fix:** add `@db.Text` with a size cap, or validate the payload size in `OutboxService.emit`.

### 5.18 [P1] `OutboxEvent.payload` is parsed in `JobQueue.processJobs` with `JSON.parse` — no error handling

**File:** `web/src/lib/job-queue.ts:102`

```ts
const job: QueueJob = {
  ...
  payload: JSON.parse(event.payload),
  ...
};
```

If `event.payload` is corrupted (e.g. truncated), `JSON.parse` throws. **The error bubbles up to `Promise.allSettled` which catches it.** But the catch path (line 120-147) treats it as a job failure, increments `attempts`, and retries. The retry fails the same way. After `maxAttempts`, the event is marked FAILED.

**The job is unrecoverable** because the payload is corrupt in the DB. The retry doesn't help.

**Fix:** add a "corrupt payload" check that marks the event as FAILED immediately (don't retry) and moves it to a quarantine.

### 5.19 [P0] `OutboxEvent.payload` is NOT redacted in the admin UI

**Pattern.**

Per the previous backend deep audit (sections 13 and 14), the audit log's `details` field has PII. The `OutboxEvent.payload` may also have PII (e.g. `riderId`, `phone`, `email`). **The admin UI may render the payload without redaction.**

**Fix:** apply `redactPii` to the payload before rendering in the admin UI.

### 5.20 [P1] No `OutboxEvent` retention policy

**File:** `web/src/server/workers/outbox.ts:141-150`

The `cleanupCompleted` function deletes COMPLETED events older than 7 days. But the FAILED events are never cleaned. **A FAILED event stays in the table forever.**

**Fix:** extend `cleanupCompleted` to also clean FAILED events (move to a quarantine table first).

---

## 6. Missing jobs / coverage gaps

These are jobs that should exist but don't.

### 6.1 [P0] No job for `DEPOSIT_REFUNDED` event

The `DEPOSIT_REFUNDED` event type exists (`outbox.ts:43`) but no consumer. **A rider's deposit refund is never processed.** Verify the use-case emits this event and add a worker.

### 6.2 [P0] No job for `RENT_DUE` event

The `RENT_DUE` event type exists (`outbox.ts:56`) but no consumer. **A rider's rent due reminder is never sent.**

### 6.3 [P0] No job for `RENT_OVERDUE` event

The `RENT_OVERDUE` event type exists (`outbox.ts:57`) and is emitted by `rent-reminders.job.ts:111` but no consumer. **The event piles up in the outbox table forever.**

### 6.4 [P0] No job for `RENT_PAID` event

The `RENT_PAID` event type exists (`outbox.ts:58`) but no consumer.

### 6.5 [P0] No job for `DEVICE_VIOLATION` event

The `DEVICE_VIOLATION` event type exists (`outbox.ts:62`) and is emitted by `device-compliance.job.ts:69` but no consumer. **A device violation alert is never sent to admin.**

### 6.6 [P0] No job for `ADMIN_ACTION` event

The `ADMIN_ACTION` event type exists (`outbox.ts:66`) and is emitted by `reconciliation.job.ts:115` but no consumer. **A reconciliation mismatch alert is never sent.**

### 6.7 [P0] No job for `REFERRAL_SIGNUP` event

The `REFERRAL_SIGNUP` event type exists (`outbox.ts:52`) but no consumer. **A new referral signup is never acknowledged.**

### 6.8 [P0] No job for `ANNOUNCEMENT_DISPATCH` event

The `ANNOUNCEMENT_DISPATCH` event type exists (`outbox.ts:48`) but no consumer. **An admin's announcement is never broadcast to riders.**

### 6.9 [P0] No DLQ retry job

A DLQ retry job should periodically move FAILED events back to PENDING with attempts=0. **Currently no such job exists.** FAILED events are stuck.

### 6.10 [P1] No scheduled task for `WalletLedger` archival

`WalletLedger` grows unbounded. **No scheduled task archives old entries** (e.g. >1 year). The DB grows.

### 6.11 [P1] No scheduled task for `OutboxEvent` retention

Already covered in 5.20. The `cleanupCompleted` exists but only for COMPLETED.

### 6.12 [P1] No scheduled task for `RiderEarning` aggregation

`RiderEarning` is per-day, per-platform. **No scheduled task aggregates by month** for the admin dashboard. The admin dashboard does it at query time (slow).

### 6.13 [P1] No scheduled task for `RiderScore` recalculation

`RiderScore.lastCalculated` exists. **No scheduled task recalculates scores** (e.g. weekly). Scores are stale.

### 6.14 [P0] No `WalletLedger` reconciliation that catches `Wallet.balanceInPaise` drift in real time

The wallet-reconciliation job runs daily. **Drift is detected, not prevented.** A scheduled task that runs every 5 min and alerts on drift would be better. **Or:** add a Postgres trigger that prevents drift (per `AUDIT_DATABASE.md` 12.1).

### 6.15 [P1] No job for `OutboxEvent` stalled-detection alert

If a job is stuck in PROCESSING for 10 min, the reaper reclaims it. **But no operator is alerted.** A `notifyOnStall` flag would alert.

### 6.16 [P0] No DLQ for `IdempotencyKey` FAILED entries

`IdempotencyKey.status = 'FAILED'` exists. **No job moves FAILED entries to a quarantine table.** FAILED entries pile up.

---

## 7. Top 10 critical findings

In order of "ship-it-this-week" priority:

1. **[P0] Two reconciliation jobs exist (`wallet-reconciliation.job.ts` and `reconciliation.job.ts`) — duplicate code.** Delete the older one. (4.1, 4.2, 5.5)
2. **[P0] 10 of 20 OutboxEvent types are orphaned — no consumer.** Audit each: is the event emitted for tracing only, or is it expected to be consumed? (1.2, 6.1-6.8)
3. **[P0] `reconciliation.job.ts:62-90` N+1 query for per-wallet ledger sum.** Replace with a single aggregation. (4.5)
4. **[P0] `rent-reminders.job.ts:65-86` auto-debit doesn't update `RentalLease.status` — double-charge risk.** Update inside the transaction. (4.14)
5. **[P0] `OutboxService.emit` is called WITHOUT a transaction in most use-cases.** Add a lint rule to enforce transactional outbox emit. (3.1, 5.1)
6. **[P0] `notifications-cleanup.job.ts` is dead code — not wired to any worker.** Wire to `SCHEDULED_TASKS`. (4.26)
7. **[P0] `JobQueue.runReaper` doesn't reset `attempts` on reclaim — failed jobs may exhaust quickly on re-run.** Reset `attempts` to 0 on reaper reclaim. (3.8)
8. **[P0] `OutboxEvent.payload` is `String` (no size cap) and no schema.** Add a size cap and JSON schema. (5.15, 5.17, 5.18)
9. **[P0] `telemetry-cleanup.job.ts` deletes PII without audit log.** Add audit log. (4.23, 4.25)
10. **[P0] `notification-dispatch.job.ts:172-178` overlay FCM error is swallowed and reported as success.** Throw on FCM failure so the event is retried. (4.7)

---

## 8. Recommended 10-PR sequence

In order of "ship-it-this-week" priority:

1. **PR 1: Delete duplicate `wallet-reconciliation.job.ts` and `notifications.job.ts` tombstone.** ~30 min.
2. **PR 2: Wire `notifications-cleanup.job.ts` to `SCHEDULED_TASKS` (every 24h).** ~30 min.
3. **PR 3: Fix `rent-reminders.job.ts` to update `RentalLease.status` inside the auto-debit transaction.** ~2 hours.
4. **PR 4: Replace N+1 in `reconciliation.job.ts:62-90` with a single aggregation query.** ~1 hour.
5. **PR 5: Fix `notification-dispatch.job.ts:172-178` to throw on FCM failure (don't swallow).** ~30 min.
6. **PR 6: Add audit log to `telemetry-cleanup.job.ts` and `notifications-cleanup.job.ts`.** ~1 hour.
7. **PR 7: Reset `attempts` to 0 on `JobQueue.runReaper` reclaim.** ~15 min.
8. **PR 8: Add size cap and JSON schema validation to `OutboxService.emit`.** ~3 hours.
9. **PR 9: Audit each orphaned event type — either add a consumer or remove the type from the enum.** ~half day.
10. **PR 10: Add transactional outbox emit lint rule and migrate all callers.** ~1 day.

**Total estimated effort:** ~5 days of focused work, single PR per item, all P0.
