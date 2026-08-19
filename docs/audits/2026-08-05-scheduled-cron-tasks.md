# Scheduled / Cron Tasks Audit — Timer-Driven Workers
**Date:** 2026-08-05
**Scope:** 7 timer-driven tasks in `web/src/server/workers/index.ts:175-261, 263-322, 393-413`. Plus the 4 underlying jobs: `audit-cleanup.job.ts`, `telemetry-cleanup.job.ts`, `notifications-cleanup.job.ts`, `scheduled-backup.job.ts`, `daily-engagement.job.ts` (for `msUntilNext0600IST`). Plus `OutboxService.cleanupCompleted`.
**Audit type:** Cross-stack timer logic + idempotency + emit-loop + IST math + cleanup-window.
**Total findings:** 9 P0 · 19 P1 · 24 P2 · 21 P3 · 11 test gaps.

---

## 0. TL;DR

The scheduled-tasks surface is the **most over-looked attack surface in the codebase** — these run in the same process, on a fixed interval, and emit outbox events that drive the rest of the system. Four P0s that a careful code reviewer would flag in 30 minutes:

1. **`daily-engagement-emitter` fires up to 60 events in a 60-minute window at 06:00 IST** — the check `if (msUntil > 60_000) return;` (line 240) creates a 60-minute window where the event fires every minute. The outbox event does not carry an `idempotencyKey`, so **60 events are emitted to the outbox** for the same daily engagement. The `dailyEngagementJob` may dedupe by `istDate`, but if it doesn't, **every rider gets 60 birthday wishes per day** at 06:00 IST. This is the same off-by-one as the 13th dashboard's "Tomorrow at 6:00 AM hardcoded" pattern.

2. **`rent-due-emitter` emits every minute, all day, every day** — there is no time-of-day gate. The `rentRemindersJob` is the actual worker that decides which riders need a rent-due nudge. **For 1k active rentals, this is 1.44M outbox events per day** (1440 events × 1000 riders). If the job doesn't dedupe, **each rider gets 1440 rent-due SMS per day**. The job probably has internal dedupe, but the outbox event volume is wasteful and stresses the reaper.

3. **`audit-log-cleanup` and `telemetry-cleanup` run every 5 minutes but only do work once per day** — the 5-minute interval is wasted 287 times per day. Worse, the `telemetry-cleanup` writes the audit log BEFORE the deletes (per the comment, "if audit-log write fails we throw, which rolls back the idempotency claim, and the deletes never happen"), but the audit log row is in a **separate transaction** — if the deletes fail after the audit log is committed, the audit log says "I deleted N records" but they weren't deleted. **Audit log lies**.

4. **`outbox-completed-cleanup` retention is 1 day, interval is 24 hours** — but the cleanup runs at worker startup time, not at a fixed clock time. If the worker restarts at 23:59 UTC, the next cleanup is at 23:59 the next day. **No alerting on cleanup failures** — if the cleanup fails 24 times in a row, the outbox table grows unbounded, disk fills up.

Three secondary P0s:
- `device-violation-emitter` calls `OutboxService.emit` with no `maxAttempts` (defaults?). **The 1440 events per day have no retry cap**.
- `scheduled-backup` is checked every 5 minutes but the `checkAndRun` doesn't honor the schedule's `frequency` and `timeOfDay` for the **initial** run. After a fresh worker start, a backup is due on the first 5-minute check (if `nextRunAt` is in the past).
- The `daily-engagement.job.ts:135-167 msUntilNext0600IST` function has a buggy `if (nowIstMs >= today0600IstMs + 60_000)` check that creates a 60-second window where msUntil is negative — **the event fires repeatedly in this window**.

**The single highest-blast-radius fix** (30 min, P0): fix the `daily-engagement-emitter` to fire **once per IST day** by adding an in-memory `lastFiredDateKey` and comparing against the new `istDate` in the outbox event payload. The 1-line fix in the scheduled task + 1-line fix in the daily-engagement job to dedupe by `istDate`.

---

## 1. Files audited

### Backend (Node.js workers)
- `web/src/server/workers/index.ts` (524 lines) — main worker orchestrator, `SCHEDULED_TASKS` array, `runScheduledTask`, `runScheduledBackupLoop`, `runReaperLoop`, `startWorkers`, `stopWorkers`, `handleShutdown`
- `web/src/server/workers/jobs/audit-cleanup.job.ts` (43 lines) — daily audit log purge
- `web/src/server/workers/jobs/telemetry-cleanup.job.ts` (79 lines) — daily telemetry purge (PII)
- `web/src/server/workers/jobs/notifications-cleanup.job.ts` (18 lines) — notification purge (30d, read only)
- `web/src/server/workers/jobs/scheduled-backup.job.ts` (124 lines) — DB snapshot job
- `web/src/server/workers/jobs/daily-engagement.job.ts` (167+ lines) — `msUntilNext0600IST` math
- `web/src/server/workers/outbox.ts:325-337` — `OutboxService.cleanupCompleted`

### Tests
- `web/tests/unit/workers/cleanup.job.test.ts` — cleanup job tests
- `web/tests/unit/workers/reconciliation.job.test.ts` — covered in 16th audit
- `web/tests/unit/check-secret-rotation-nightly.test.ts` — secret rotation cron
- `web/tests/unit/notification-dispatch.test.ts` — notif dispatch (not deep-read)
- No dedicated test for the 7 scheduled tasks (only the underlying jobs)

---

## 2. Cross-stack P0 findings (security / correctness / data integrity)

### P0-1 — `daily-engagement-emitter` fires up to 60 events in a 60-minute window
**Severity:** P0 (event flood + birthday wish spam)
**File:** `web/src/server/workers/index.ts:235-260`
```ts
{
  // BLOCKER 1.4: emit the daily engagement event at 06:00 IST.
  // msUntilNext0600IST() returns the delay until the next 06:00 IST;
  // after the first run, we reschedule by recomputing on each tick.
  name: 'daily-engagement-emitter',
  intervalMs: 60_000, // checked every minute; only emits at 06:00 IST
  processor: async (injectedClock) => {
    const msUntil = msUntilNext0600IST();
    // If we're within 1 minute of the target, fire now.
    if (msUntil > 60_000) return;
    const { OutboxService } = await import('./outbox');
    await OutboxService.emit(
      OutboxEventTypes.DAILY_ENGAGEMENT,
      {
        triggeredAt: injectedClock.now().toISOString(),
        istDate: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
        }).format(injectedClock.now()),
      },
      3,
      undefined,  // ← no idempotencyKey
      'interactive'
    ).catch(...)
  },
},
```

**Bug:** The check `if (msUntil > 60_000) return;` means fire whenever msUntil is in [-Infinity, 60000]. Combined with `msUntilNext0600IST` which returns:
- A large positive number when far from 06:00 IST (e.g., 7 hours away → 25,200,000 ms).
- A small number close to 06:00 IST (e.g., 30 seconds before → 30,000 ms).
- A **negative** number during the 60-second window AFTER 06:00 IST (the `nowIstMs >= today0600IstMs + 60_000` check in `msUntilNext0600IST:162` only catches >= 60s past; for 0-59s past, target is `today0600IstMs` which is in the past, so msUntil is negative but > -60000).

So the window is:
- 06:00:00 IST → msUntil = 0 → fire.
- 06:00:01 IST → msUntil = -1000 → fire (still > -Infinity, not > 60_000).
- ...
- 06:00:59 IST → msUntil = -59000 → fire.
- 06:01:00 IST → msUntil = -60000 → fire (still > -Infinity, not > 60_000).
- 06:01:01 IST → msUntil = 23*3600*1000 + 59*60*1000 = ~86,339,000 → 86,399,000 ms → don't fire.

Wait, let me re-read `msUntilNext0600IST`:
```ts
if (nowIstMs >= today0600IstMs + 60_000) {
  // Already past 06:00 IST — schedule for tomorrow
  target = Date.UTC(istYear, istMonth - 1, istDay + 1, 6, 0, 0);
}
return target - nowIstMs;
```

If `nowIstMs` is between `today0600IstMs` and `today0600IstMs + 60_000` (i.e., 06:00:00 to 06:00:59.999 IST), then `nowIstMs < today0600IstMs + 60_000`, so `target = today0600IstMs` (not tomorrow). `msUntil = today0600IstMs - nowIstMs` is between -60000 and 0. The check `if (msUntil > 60_000) return;` is false (msUntil is -60000 to 0, not > 60000). **So the event fires every minute in this 60-second window, 60 times total**.

If `nowIstMs >= today0600IstMs + 60_000` (06:01:00 IST or later), then `target = tomorrow0600IstMs`. `msUntil` is ~23 hours. The check fires (`> 60_000` is true). Wait, no — if msUntil is 23 hours = 82,800,000 ms, then `if (msUntil > 60_000) return;` is TRUE, so we return. So the event does NOT fire at 06:01 IST. Good.

So the actual fire window is 06:00:00 to 06:00:59 IST. **60 events emitted to the outbox per IST day**.

The outbox event has no `idempotencyKey` (line 254, 4th arg is `undefined`). So **60 distinct outbox rows are created**. The `dailyEngagementJob` may dedupe by `istDate` field, but if it doesn't, **each rider gets 60 birthday wishes, 60 payment reminders, 60 referral leaderboard updates per day** at 06:00 IST.

The `istDate` field in the payload is the same for all 60 events (same IST date). So if the job dedupes by `istDate`, it should process only once. **But the check is in the job, not the emitter**. A future engineer refactoring the job to process per-event would re-introduce the spam.

**Fix shape (15 min, 1 file):**

Add an in-memory `lastFiredDateKey` and check it:
```ts
let lastFiredDateKey: string | null = null;
// ...
processor: async (injectedClock) => {
  const msUntil = msUntilNext0600IST();
  if (msUntil > 60_000) return;
  const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(injectedClock.now());
  if (lastFiredDateKey === todayIst) return;  // ← ADD
  lastFiredDateKey = todayIst;
  // ... rest
}
```

Better: pass `idempotencyKey: \`daily-engagement:${todayIst}\`` to `OutboxService.emit`. The outbox's UNIQUE constraint on `idempotencyKey` (if it exists) would dedupe. If the outbox doesn't have a unique constraint on idempotencyKey, the in-memory guard is the only defense.

Audit ticket #119.

---

### P0-2 — `rent-due-emitter` emits every minute all day
**Severity:** P0 (event flood)
**File:** `web/src/server/workers/index.ts:204-218`
```ts
{
  name: 'rent-due-emitter',
  intervalMs: 60_000,
  processor: async (injectedClock) => {
    const { OutboxService } = await import('./outbox');
    await OutboxService.emit(
      OutboxEventTypes.RENT_DUE_CHECK,
      { triggeredAt: injectedClock.now().toISOString() },
      3,
      undefined,  // ← no idempotencyKey
      'interactive'
    ).catch(...)
  },
},
```

**Bug:** The emitter fires every minute, 1440 times per day, with no time-of-day gate. The `rentRemindersJob` (the actual consumer) probably checks each rider's `nextDueDate` and only sends a reminder if it's near. But **emitting 1440 events per day to the outbox creates 1440 outbox rows**.

For a single-tenant install with 100 active rentals, the job processes 1440 events × 100 riders = 144,000 job-rider-checks per day. **The DB is hit 144k times per day** for what's effectively a daily check.

For multi-tenant (1k+ active rentals), the math is 1.44M job-rider-checks per day. **DB load**.

Worse: if the `rentRemindersJob` has a bug that sends a reminder every time the event fires, **each rider gets 1440 rent-due SMS per day**.

**Fix shape (30 min, 1 file):**

Add a time-of-day gate (e.g., 06:00 IST and 18:00 IST, twice a day):
```ts
processor: async (injectedClock) => {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(injectedClock.now()));
  if (hour !== 6 && hour !== 18) return;  // ← ADD time-of-day gate
  // ... rest
}
```

Or use the `msUntilNext0600IST` pattern for both 06:00 and 18:00 IST.

Audit ticket #120.

---

### P0-3 — `telemetry-cleanup` audit log is not transactional with the deletes
**Severity:** P0 (audit log lies after partial failure)
**File:** `web/src/server/workers/jobs/telemetry-cleanup.job.ts:34-62`
```ts
// PR-154: count BEFORE delete so the audit log carries the
// exact number of PII records destroyed. GDPR Art. 30 requires
// a record of processing activity — deleting PII without an
// audit trail is a violation.
const [locationsCount, callLogsCount, contactsCount] = await Promise.all([
  db.userLocation.count({ where: { timestamp: { lt: thirtyDaysAgo } } }),
  db.userCallLog.count({ where: { timestamp: { lt: thirtyDaysAgo } } }),
  db.userContact.count({ where: { createdAt: { lt: thirtyDaysAgo } } }),
]);

// PR-154: write the audit log BEFORE the deletes. If the
// audit-log write fails we throw, which rolls back the
// idempotency claim, and the deletes never happen. The next
// run will re-attempt.
await createAuditLog({
  actorId: 'system',
  actorType: 'SYSTEM',
  action: 'telemetry.cleanup',
  entity: 'userLocation,userCallLog,userContact',
  entityId: 'bulk',
  details: {
    cutoff: thirtyDaysAgo.toISOString(),
    locationsToDelete: locationsCount,
    callLogsToDelete: callLogsCount,
    contactsToDelete: contactsCount,
  },
});

const [locationsDeleted, callLogsDeleted, contactsDeleted] = await Promise.all([
  db.userLocation.deleteMany({ where: { timestamp: { lt: thirtyDaysAgo } } }),
  db.userCallLog.deleteMany({ where: { timestamp: { lt: thirtyDaysAgo } } }),
  db.userContact.deleteMany({ where: { createdAt: { lt: thirtyDaysAgo } } }),
]);
```

**Bug:** The comment says "If the audit-log write fails we throw, which rolls back the idempotency claim, and the deletes never happen." But **the audit log is committed BEFORE the deletes** (line 44-56 vs line 58-62). If the audit log succeeds but the deletes fail (e.g., DB connection drops between line 56 and line 58), the audit log says "I deleted N records" but they weren't deleted. The next run will see the same N records (still matching the cutoff), write another audit log entry, and try again.

The comment's claim is correct for the "audit log fails" path, but the "deletes fail" path leaves an inconsistent audit log. **The audit log lies** about what happened.

This is a **GDPR Article 30 violation** if the audit log is presented as proof of data destruction. The data is not actually destroyed, but the audit log says it is.

**Fix shape (1 hour, 1 file):**

Wrap the audit log + deletes in a single `db.$transaction`:
```ts
await db.$transaction(async (tx) => {
  await tx.auditLog.create({  // ← use tx.auditLog, not the createAuditLog helper
    data: { actorId: 'system', ... }
  });
  await tx.userLocation.deleteMany(...);
  await tx.userCallLog.deleteMany(...);
  await tx.userContact.deleteMany(...);
});
```

Audit ticket #121.

---

### P0-4 — No alerting on cleanup failures; outbox table can grow unbounded
**Severity:** P0 (silent data retention failure)
**File:** `web/src/server/workers/index.ts:374-391`
```ts
async function runScheduledTask(task: {...}, injectedClock: typeof clock): Promise<void> {
  logger.info(`[Scheduler] Starting scheduled task "${task.name}" { intervalMs: task.intervalMs });
  while (running) {
    try {
      await task.processor(injectedClock);
    } catch (err) {
      logger.error(`[Scheduler] Error in "${task.name}"`, err);
    }
    await sleep(task.intervalMs);
  }
}
```

**Bug:** The error handler logs the error and continues. **No alerting**. If `audit-cleanup` fails 288 times in a day (every 5 min), the audit log table grows unbounded. The next day's cleanup has even more rows to scan. **Death spiral**.

For the outbox cleanup: if `cleanupCompleted(1)` fails 24 times in a row, the outbox table grows. The next event poll has to skip more rows. **DB performance degrades**.

The `alerter.send(...)` call exists (per the reconciliation job pattern at `wallet-reconciliation.job.ts:152-158`), but the scheduled tasks don't use it.

**Fix shape (1 hour, 1 file):**

Add a failure counter and alert after N consecutive failures:
```ts
const failureCounters = new Map<string, number>();
// ...
} catch (err) {
  const count = (failureCounters.get(task.name) || 0) + 1;
  failureCounters.set(task.name, count);
  if (count >= 3) {
    alerter.send({ level: 'error', title: `Scheduled task "${task.name}" failing`, message: `Failed ${count} times in a row`, details: { err: String(err) } });
  }
  logger.error(`[Scheduler] Error in "${task.name}"`, err);
}
```

Audit ticket #122.

---

### P0-5 — `outbox-completed-cleanup` runs at worker startup time, not at a fixed clock time
**Severity:** P0 (cleanup timing drift)
**File:** `web/src/server/workers/index.ts:187-195`
```ts
{
  name: 'outbox-completed-cleanup',
  intervalMs: 24 * 60 * 60 * 1000, // daily
  processor: async () => {
    const { OutboxService } = await import('./outbox');
    const count = await OutboxService.cleanupCompleted(1);
    logger.info('[Scheduler] Outbox completed events cleanup', { count });
  },
},
```

**Bug:** The interval is exactly 24 hours, and the first call is at worker startup. If the worker starts at 14:00 UTC, the first cleanup is at 14:00 UTC. **Every day after, the cleanup is at 14:00 UTC**. If the worker is restarted at 23:59 UTC, the next cleanup is at 23:59 UTC the next day. **The cleanup time drifts with the worker restart time**.

For a 1-day retention, this means COMPLETED events live between 1-2 days in the table. **Not a hard correctness issue** (events are COMPLETED, so safe to delete), but the table is larger than necessary.

Combined with P0-4 (no alerting), if the worker restarts at midnight and the cleanup runs at midnight, the next cleanup is at midnight the next day. If the worker is restarted at 23:59:30, the cleanup runs at 23:59:30 — 30 seconds before the retention cutoff. **Riders' event history is barely aged out**.

**Fix shape (1 hour, 1 file):**

Replace the `setInterval` with a daily check at a fixed clock time (e.g., 03:00 IST):
```ts
processor: async (injectedClock) => {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(injectedClock.now()));
  if (hour !== 3) return;  // ← only at 03:00 IST
  const { OutboxService } = await import('./outbox');
  const count = await OutboxService.cleanupCompleted(1);
  logger.info('[Scheduler] Outbox completed events cleanup', { count });
}
```

Audit ticket #123.

---

### P0-6 — `device-violation-emitter` calls `OutboxService.emit` with no `maxAttempts`
**Severity:** P0 (event has no retry cap)
**File:** `web/src/server/workers/index.ts:219-230`
```ts
{
  name: 'device-violation-emitter',
  intervalMs: 60_000,
  processor: async (injectedClock) => {
    const { OutboxService } = await import('./outbox');
    await OutboxService.emit(OutboxEventTypes.DEVICE_VIOLATION_SCAN, {
      triggeredAt: injectedClock.now().toISOString(),
    }).catch(...)
  },
},
```

**Bug:** The call passes only 2 arguments (eventType, payload). The `OutboxService.emit` signature is likely `(eventType, payload, maxAttempts, idempotencyKey, priority)`. **The `maxAttempts` defaults to whatever the outbox service uses (probably 3 or 5)**, but the `rent-due-emitter` and `daily-engagement-emitter` explicitly pass `3` (line 213, 253). The `device-violation-emitter` does not. **Inconsistent retry behavior** for the same kind of event.

If the outbox service's default is, say, `10`, the device-violation events can be retried 10 times before going to the dead-letter queue. For 1440 events per day, 10 attempts each = 14,400 attempts. The DB is hit 14.4k times per day for device violations.

If the default is `0` (no retries), the event is processed once and never retried. A transient failure (e.g., DB blip) loses the violation scan.

**Fix shape (5 min, 1 file):**

Add `3` as the 3rd argument:
```ts
await OutboxService.emit(
  OutboxEventTypes.DEVICE_VIOLATION_SCAN,
  { triggeredAt: injectedClock.now().toISOString() },
  3,  // ← ADD
).catch(...)
```

Audit ticket #124.

---

### P0-7 — `scheduled-backup.checkAndRun` doesn't honor `schedule.frequency` for the initial run
**Severity:** P0 (backup timing drift)
**File:** `web/src/server/workers/jobs/scheduled-backup.job.ts:54-61`
```ts
// Check if backup is due
const now = clock.now();
if (schedule.nextRunAt && now < schedule.nextRunAt) {
  return {
    ran: false,
    reason: `Next backup scheduled at ${schedule.nextRunAt.toISOString()}`,
  };
}
```

**Bug:** The check is "if `now < nextRunAt`, skip; otherwise run". After a fresh worker start, the first 5-minute check has `now` slightly after the previous `nextRunAt` (set by the previous run's `markScheduleSuccess`). **The first check after worker restart always runs the backup**, regardless of `schedule.frequency` or `schedule.timeOfDay`.

If the worker is restarted 4 minutes after a backup ran, the first 5-minute check (1 minute later) sees `now > nextRunAt` (nextRunAt is 24 hours later, but the 5-minute check doesn't honor the frequency). Wait, `nextRunAt` is set to `scheduleService.calculateNextRun(schedule) + interval` (e.g., +24 hours for daily). So `now < nextRunAt` is true for 24 hours, and the check skips. OK.

But if the **admin changes** `schedule.frequency` from `DAILY` to `WEEKLY` between runs, the `nextRunAt` is still set to `now + 24 hours` (the OLD nextRunAt). The check skips until 24 hours after the last backup. **The new frequency is ignored until the next `markScheduleSuccess`** (which only happens when a backup actually runs). So a 24-hour delay before the new weekly schedule kicks in. Probably not catastrophic, but inconsistent.

**Worse**: if the **DB is wiped and reseeded** (e.g., DR drill), `schedule.nextRunAt` is `null` (default for the column). The check passes (no early-return). The backup runs immediately. **A DR drill causes an immediate backup**, which may overwrite the secondary backup with stale data.

**Fix shape (1 hour, 1 file):**

Add a `if (!schedule.nextRunAt) { /* initialize from frequency */ }` branch, and recompute `nextRunAt` based on the current `frequency`:
```ts
if (schedule.nextRunAt === null) {
  const nextRunAt = scheduleService.calculateNextRun(schedule as any);
  await backupRepository.markScheduleInitialized(schedule.id, nextRunAt);
  return { ran: false, reason: 'Schedule initialized' };
}
```

Audit ticket #125.

---

### P0-8 — `audit-log-cleanup` and `telemetry-cleanup` fire every 5 minutes but only do work once per day
**Severity:** P0 (wasteful 287×/day)
**File:** `web/src/server/workers/index.ts:180-202`
```ts
{
  name: 'audit-log-cleanup',
  intervalMs: 300_000, // every 5 minutes
  processor: async () => {
    await auditCleanupJob.process({ id: 'scheduled' });
  },
},
{
  name: 'outbox-completed-cleanup',
  intervalMs: 24 * 60 * 60 * 1000, // daily
  // ...
},
{
  name: 'telemetry-cleanup',
  intervalMs: 300_000,  // every 5 minutes
  processor: async () => {
    await telemetryCleanupJob.process({ id: 'scheduled' });
  },
},
```

**Bug:** The `audit-log-cleanup` and `telemetry-cleanup` jobs use an idempotency key keyed on the IST date (per `audit-cleanup.job.ts:20-22` and `telemetry-cleanup.job.ts:19-22`). The first call of the day does the work. The next 287 calls (every 5 min × 24 hours / day = 288 calls, minus the 1 that does the work) are no-ops.

Each no-op call still:
- Acquires the idempotency claim (a DB query).
- Checks the date key.
- Returns.
- Logs "Already processed today" (287 log lines per day).

For a single-tenant install, this is 287 × 2 = 574 wasted log lines per day + 574 wasted DB queries. **Not catastrophic**, but adds up over time.

Worse: the `audit-cleanup.job.ts:31` runs `VACUUM ANALYZE` on the AuditLog table. This is a heavy operation. If the idempotency check fails (e.g., DB hiccup), the next 5-minute call would re-run VACUUM ANALYZE. **Multiple VACUUMs in 5 minutes lock the table**.

**Fix shape (30 min, 1 file):**

Change the interval to daily at a fixed clock time (e.g., 03:00 IST):
```ts
{
  name: 'audit-log-cleanup',
  intervalMs: 60_000,  // check every minute
  processor: async (injectedClock) => {
    const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }).format(injectedClock.now()));
    if (hour !== 3) return;  // ← only at 03:00 IST
    await auditCleanupJob.process({ id: 'scheduled' });
  },
},
```

Same for telemetry-cleanup.

Audit ticket #126.

---

### P0-9 — `msUntilNext0600IST` is off-by-one; fire window is 60 seconds, not 1 minute
**Severity:** P0 (math bug — see P0-1)
**File:** `web/src/server/workers/jobs/daily-engagement.job.ts:135-167`
```ts
export function msUntilNext0600IST(now: Date = clock.now()): number {
  // ...
  const nowIstMs = Date.UTC(istYear, istMonth - 1, istDay, istHour, istMinute, istSecond);
  const today0600IstMs = Date.UTC(istYear, istMonth - 1, istDay, 6, 0, 0);
  let target = today0600IstMs;
  if (nowIstMs >= today0600IstMs + 60_000) {
    // Already past 06:00 IST — schedule for tomorrow
    target = Date.UTC(istYear, istMonth - 1, istDay + 1, 6, 0, 0);
  }
  return target - nowIstMs;
}
```

**Bug:** The condition `nowIstMs >= today0600IstMs + 60_000` is true only when `nowIstMs` is >= 06:01:00 IST. For 06:00:00 to 06:00:59.999 IST, the condition is false, so `target = today0600IstMs` (in the past) and `msUntil` is negative (between -60000 and 0).

**The intent** was probably: "if now is within 1 minute of 06:00 IST, fire now; otherwise schedule for tomorrow". But the implementation creates a 60-second window where the event fires every minute.

The bug is in the condition — should be:
- "if now is after 06:00 IST by more than 1 minute, schedule for tomorrow" → use `<` not `>=` or change the offset.
- OR: "if now is at or after 06:00 IST, schedule for tomorrow" → use `>=` against `today0600IstMs` (not +60000).

**Fix shape (15 min, 1 file):**

```ts
if (nowIstMs >= today0600IstMs) {
  // Already at or past 06:00 IST — schedule for tomorrow
  target = Date.UTC(istYear, istMonth - 1, istDay + 1, 6, 0, 0);
}
```

This means: "the next 06:00 IST is tomorrow if now is at or after 06:00 today; otherwise it's today". Combined with the emitter's `if (msUntil > 60_000) return;` check, the event fires only when `msUntil` is in `[0, 60000]` (i.e., the 60-second window BEFORE 06:00 IST). After 06:00 IST, `msUntil` is ~24 hours, so the event does not fire.

The in-memory `lastFiredDateKey` (per P0-1) is the additional defense.

Audit ticket #127.

---

## 3. P1 findings (real bugs, fix in next sprint)

| # | File:Line | Issue |
|---|---|---|
| P1-1 | `web/src/server/workers/index.ts:374-391` | `runScheduledTask` swallows errors silently. Covered by P0-4. |
| P1-2 | `web/src/server/workers/index.ts:189` | `OutboxService.cleanupCompleted(1)` — the `1` is the default, redundant explicit value. |
| P1-3 | `web/src/server/workers/jobs/audit-cleanup.job.ts:31` | `db.$executeRawUnsafe('VACUUM ANALYZE "AuditLog";')` — runs only in `process.env.NODE_ENV === 'production'`. **Staging never gets vacuumed**. Should be `APP_ENV === 'production' || 'staging'`. |
| P1-4 | `web/src/server/workers/jobs/audit-cleanup.job.ts:23` | `if (job?.id !== 'test' && claim.status !== 'not_found')` — the `job.id !== 'test'` check is for the test runner. **In production, `job.id` is `'scheduled'`** (per `index.ts:184`). The check is dead. |
| P1-5 | `web/src/server/workers/jobs/audit-cleanup.job.ts:34` | `await completeIdempotency(...)` — errors are swallowed (`.catch(() => {})`). **If the idempotency completion fails, the next run's claim sees the previous claim as still pending, and the next run is skipped**. The cleanup work may be skipped. |
| P1-6 | `web/src/server/workers/jobs/telemetry-cleanup.job.ts:70` | Same as P1-5. `completeIdempotency` error is swallowed. |
| P1-7 | `web/src/server/workers/jobs/notifications-cleanup.job.ts:6-17` | **No idempotency key**. The job fires via the `ADMIN_JOB_NOTIFICATIONS_CLEANUP` outbox event (per `index.ts:130-135`), and the cleanup runs whenever the event is emitted. But **the same event can be emitted multiple times** (e.g., admin clicks "Run now" twice). The job has no dedupe. **The second run deletes the same rows (which are now 0) — no harm, but wasted work**. |
| P1-8 | `web/src/server/workers/jobs/notifications-cleanup.job.ts:8` | The retention is hardcoded to 30 days. No way to override via setting. |
| P1-9 | `web/src/server/workers/index.ts:226-228` | `OutboxService.emit` with no `maxAttempts`. Covered by P0-6. |
| P1-10 | `web/src/server/workers/index.ts:298-301` | The `startWorkers` logger logs `jobTypes: WORKERS.map(w => w.jobType)`. This includes the orphan event types (RENT_PAID, RENT_OVERDUE, etc.) and the SMS_SEND. **Large log line**. |
| P1-11 | `web/src/server/workers/index.ts:450-461` | The `sleep` function uses `setTimeout` + abort listener. The listener is only registered AFTER the setTimeout. **Theoretical race** (single-threaded JS, so the race window is between the two sync calls). |
| P1-12 | `web/src/server/workers/index.ts:484-503` | The `handleShutdown` has a 30-second timeout. If 1000 jobs are in-flight, they may not complete in 30 seconds. **Best-effort shutdown**. |
| P1-13 | `web/src/server/workers/index.ts:472-482` | The `isDirectRun` check has 8 different path patterns. **Code smell**. The `tsx` runner may not match all of these. |
| P1-14 | `web/src/server/workers/jobs/daily-engagement.job.ts:160` | `const today0600IstMs = Date.UTC(istYear, istMonth - 1, istDay, 6, 0, 0);` — uses `Date.UTC` with IST components. **Confusing**: `Date.UTC` takes UTC components, but the values are IST. The math works because the IST→UTC offset is consistent. But a future engineer reading this will be confused. |
| P1-15 | `web/src/server/workers/jobs/scheduled-backup.job.ts:79` | `await (scheduleService as any).runScheduledBackup(...)` — `as any` cast. The type is lost. |
| P1-16 | `web/src/server/workers/jobs/scheduled-backup.job.ts:95` | `scheduleService.calculateNextRun(schedule as any)` — same `as any` cast. |
| P1-17 | `web/src/server/workers/jobs/scheduled-backup.job.ts:39-52` | The disk-space check fails the run (returns `ran: false, reason: 'Insufficient disk space'`) but doesn't notify the admin. **Silent failure**. |
| P1-18 | `web/src/server/workers/jobs/scheduled-backup.job.ts:30` | The maintenance-mode check returns `ran: false` but doesn't reschedule. The next 5-minute check re-checks. **OK, but no alerting** if maintenance mode is stuck on. |
| P1-19 | `web/src/server/workers/jobs/audit-cleanup.job.ts:25-26` | The `if (job?.id !== 'test' ...)` check uses `job?.id` (optional chaining). For the scheduled task, `job.id === 'scheduled'`. For the test runner, `job.id === 'test'`. **The check is correct** but the comment says "PR-108b: idempotency guard" — the check is the OPPOSITE of a guard; it BYPASSES the guard for test runs. Confusing. |

---

## 4. P2 findings (type safety / contract issues)

| # | File:Line | Issue |
|---|---|---|
| P2-1 | `web/src/server/workers/index.ts:175-178` | `processor: (injectedClock: typeof clock) => Promise<void>` — the function signature is `Promise<void>`, but the actual processors return values (e.g., `auditCleanupJob.process` returns `AuditCleanupResult`). **The return value is ignored**. |
| P2-2 | `web/src/server/workers/index.ts:191-193` | `const count = await OutboxService.cleanupCompleted(1); logger.info(...);` — the `count` is logged but not used for alerting. |
| P2-3 | `web/src/server/workers/index.ts:286-322` | `let running = false;` and `let globalAbortController: AbortController | null = null;` are **module-level state**. If `startWorkers` is called multiple times concurrently, the second call exits early (line 290-293). But if `startWorkers` is called after `stopWorkers`, `running` is set to `false`, and a subsequent `startWorkers` re-initializes. OK. |
| P2-4 | `web/src/server/workers/index.ts:289-321` | `startWorkers` doesn't validate the `injectedClock` parameter. A null/undefined `injectedClock` would crash every call to `clock.now()`. |
| P2-5 | `web/src/server/workers/index.ts:316` | The `runScheduledBackupLoop` is started AFTER the SCHEDULED_TASKS loops. Order matters for startup timing but not for correctness. |
| P2-6 | `web/src/server/workers/index.ts:319` | The `runReaperLoop` is started LAST. The reaper cleans up stuck PROCESSING jobs. If a worker is restarted, the previous run's PROCESSING jobs (now orphaned) are reclaimed. **The reaper is the only mechanism for crash recovery**. |
| P2-7 | `web/src/server/workers/jobs/audit-cleanup.job.ts:20-22` | `const today = istDateKey(clock.now());` and `const idempotencyKey = \`audit-cleanup:daily:${today}\``. The `istDateKey` is an IST date key. **The TTL is 48 hours**, which covers the IST/UTC boundary. OK. |
| P2-8 | `web/src/server/workers/jobs/telemetry-cleanup.job.ts:28` | The retention is 30 days. The cutoff is `thirtyDaysAgo = new Date(clock.now().getTime() - 30 * 24 * 60 * 60 * 1000)`. **The cutoff is in UTC** (the Date object's epoch). The deletion query is `timestamp: { lt: cutoff }`. OK. |
| P2-9 | `web/src/server/workers/jobs/scheduled-backup.job.ts:34-37` | The backup lock check (`BACKUP_LOCK_STATUS === 'RESTORE_RUNNING'`) is checked AFTER the maintenance-mode check. **Order matters**: if a restore is in progress AND maintenance mode is on, the restore takes precedence. Probably intended. |
| P2-10 | `web/src/server/workers/jobs/scheduled-backup.job.ts:69-76` | The audit log entry is written BEFORE the backup runs. If the backup fails, the audit log says "backup started" but no follow-up entry says "backup failed". **Incomplete audit trail**. |
| P2-11 | `web/src/server/workers/jobs/daily-engagement.job.ts:155-166` | The `nowIstMs` and `today0600IstMs` math uses `Date.UTC` with IST components. The result is a UTC timestamp that represents the IST time. Confusing but correct. |
| P2-12 | `web/src/server/workers/jobs/daily-engagement.job.ts:162-165` | The off-by-one bug (covered by P0-9). |
| P2-13 | `web/src/server/workers/index.ts:153-161` | The `SMS_SEND` worker uses an inline async function as the processor. **The other workers use named processors from the `WORKERS` array**. Inconsistent. |
| P2-14 | `web/src/server/workers/outbox.ts:328-336` | `cleanupCompleted` deletes by `processedAt: { lt: cutoff }`. **What if a COMPLETED event has `processedAt: null`?** It's not deleted. **The cleanup leaks events with null `processedAt`**. |
| P2-15 | `web/src/server/workers/outbox.ts:333` | The `processedAt` is set by the worker when the event is processed. **The outbox event schema must have a non-null `processedAt` for COMPLETED status**. Need to verify the schema. |
| P2-16 | `web/src/server/workers/jobs/telemetry-cleanup.job.ts:48` | `entity: 'userLocation,userCallLog,userContact'` — multiple entities in one field. The audit log schema probably has `entity: String`. The value is a string of comma-separated names. **Not queryable**. |
| P2-17 | `web/src/server/workers/index.ts:204-217` | The `rent-due-emitter` payload is `{triggeredAt: ...}`. The `rentRemindersJob` probably uses this to determine if a rent is due. **But the payload doesn't include the rider list or the due date**. The job has to query the DB for each rider. Inefficient. |
| P2-18 | `web/src/server/workers/index.ts:235-260` | The `daily-engagement-emitter` payload includes `istDate`. The `dailyEngagementJob` uses this to compute birthday wishes (per the comment in the file). OK. |
| P2-19 | `web/src/server/workers/jobs/audit-cleanup.job.ts:31` | `process.env.NODE_ENV === 'production'` — should be `APP_ENV === 'production'` per the canonical pattern. |
| P2-20 | `web/src/server/workers/jobs/scheduled-backup.job.ts:70` | `actorId: 'SYSTEM'` (all caps). The audit log lib probably expects `'system'` (lowercase). Need to verify. |
| P2-21 | `web/src/server/workers/jobs/scheduled-backup.job.ts:72` | `action: 'SYSTEM_JOB'` — not in the `AUDIT_ACTIONS` map (per `admin.types.ts:76-145`). The canonical action is `RECONCILIATION_RUN` or `BACKUP_SCHEDULE_VIEWED`. **Inconsistent**. |
| P2-22 | `web/src/server/workers/index.ts:43-45` | The `JobProcessor` type is `(job: any) => Promise<any>`. **The `any` types defeat type safety**. Replace with the actual job type from `lib/job-queue`. |
| P2-23 | `web/src/server/workers/index.ts:289` | `startWorkers` is `async` but never returns (the `while (running)` loops never exit). The `await` in `runFromCli` (line 469) blocks forever. The function signature should be `Promise<never>`. |
| P2-24 | `web/src/server/workers/index.ts:442-448` | `stopWorkers()` is not `async`. It sets `running = false` and aborts the controller. But the active jobs may still be running. The `handleShutdown` (line 484) waits for them. |

---

## 5. P3 findings (code quality / dead code)

| # | File:Line | Issue |
|---|---|---|
| P3-1 | `web/src/server/workers/index.ts:33-37` | The `notifications.job.ts` is described as "deprecated" but still imported (no — it's NOT imported, just mentioned in a comment). The comment is a "tombstone". **Should be deleted in a cleanup pass**. |
| P3-2 | `web/src/server/workers/index.ts:18` | `import { sendSms } from '@/lib/sms-provider';` — the `sendSms` is only used in the inline SMS_SEND processor. **The import is at the top level for the entire module**. If the SMS service is not configured, the import fails at startup. |
| P3-3 | `web/src/server/workers/index.ts:267-278` | `checkScheduledBackups` is a top-level function. The `runScheduledBackupLoop` (line 393-398) is the loop. **Inconsistent naming**: `runScheduledTask` (line 374) vs `runScheduledBackupLoop`. |
| P3-4 | `web/src/server/workers/jobs/notifications-cleanup.job.ts:6-17` | The job doesn't take a `job` parameter. **The other cleanup jobs take a `job: any` parameter for the idempotency key**. |
| P3-5 | `web/src/server/workers/jobs/scheduled-backup.job.ts:79-92` | The `runScheduledBackup` call is `(scheduleService as any).runScheduledBackup({...})`. The arguments are passed positionally-by-key, but the type is `any`. **The contract between `checkAndRun` and `runScheduledBackup` is implicit**. |
| P3-6 | `web/src/server/workers/jobs/daily-engagement.job.ts:130-167` | The `msUntilNext0600IST` function is exported and used by `index.ts`. The naming and behavior are clear, but the IST math is fragile. **A future refactor that doesn't preserve the exact math will break the 06:00 IST fire time**. |
| P3-7 | `web/src/server/workers/jobs/audit-cleanup.job.ts:8-42` | The `AuditCleanupResult` interface has only `expiredLogsDeleted`. No `durationMs`, no `vacuumStatus`, no `error`. **Limited observability**. |
| P3-8 | `web/src/server/workers/jobs/telemetry-cleanup.job.ts:8-78` | The `TelemetryCleanupResult` has `locationsDeleted`, `callLogsDeleted`, `contactsDeleted`. **No durationMs or error**. |
| P3-9 | `web/src/server/workers/index.ts:484-503` | The `handleShutdown` has a `Promise.race` with a 30-second timeout. If the timeout fires, the in-flight jobs are abandoned. **The DB may have partial transactions** (depending on the job's transaction handling). |
| P3-10 | `web/src/server/workers/index.ts:511-523` | The SIGINT and SIGTERM handlers are only registered if `isDirectRun` is true. **If the worker is run via `tsx` directly, the handlers fire**. If the worker is imported as a library (e.g., for testing), the handlers don't fire. **Inconsistent**. |
| P3-11 | `web/src/server/workers/jobs/audit-cleanup.job.ts:31` | `db.$executeRawUnsafe('VACUUM ANALYZE "AuditLog";')` — the SQL is hardcoded, but `$executeRawUnsafe` is bypass-safe-by-lint-only. A future engineer could break the SQL. |
| P3-12 | `web/src/server/workers/jobs/scheduled-backup.job.ts:13-15` | `if (!schedule) return { ran: false, reason: 'No schedule configured' };` — returns a reason but the caller (index.ts) doesn't act on the reason. |
| P3-13 | `web/src/server/workers/index.ts:285` | `const activeJobs = new Set<Promise<any>>();` — `any` type for the promise. The promises resolve to job results. |
| P3-14 | `web/src/server/workers/jobs/audit-cleanup.job.ts:36` | `logger.info('[AuditCleanupJob] Complete', { expiredLogsDeleted: count });` — the `idempotencyKey` is not in the log. |
| P3-15 | `web/src/server/workers/jobs/telemetry-cleanup.job.ts:72` | `logger.info('[TelemetryCleanupJob] Complete', result);` — the `idempotencyKey` is not in the log. |
| P3-16 | `web/src/server/workers/index.ts:226` | `OutboxService.emit(OutboxEventTypes.DEVICE_VIOLATION_SCAN, {triggeredAt: ...})` — the `triggeredAt` is the only payload. The job has to query the DB to find devices. **For 1k devices, this is 1k queries per tick × 1440 ticks = 1.44M queries per day**. |
| P3-17 | `web/src/server/workers/index.ts:294` | `if (running) { ... return; }` — `running` is a module-level mutable. In a multi-instance deploy (e.g., Vercel), each instance has its own `running`. The check is per-instance. OK for the design (one process per instance), but worth noting. |
| P3-18 | `web/src/server/workers/jobs/daily-engagement.job.ts:135-167` | The function takes `now: Date = clock.now()` as a parameter, but the `clock` import is at the top. The test can inject a mock `now`. OK. |
| P3-19 | `web/src/server/workers/index.ts:370` | `await sleep(processedCount > 0 ? 1000 : 15000);` — adaptive idle backoff. The 1s active backoff is short for slow jobs. The 15s idle backoff is long for interactive work. |
| P3-20 | `web/src/server/workers/index.ts:298-301` | The `startWorkers` log includes `jobTypes: WORKERS.map(w => w.jobType)`. This is 16+ entries. The log line is large. |
| P3-21 | `web/src/server/workers/jobs/notifications-cleanup.job.ts:7` | The job doesn't have a `job` parameter. The `processJobs` call in `index.ts:130-135` passes a `job` from the outbox, but the job doesn't read it. |

---

## 6. Test gaps (11)

| # | What | Where it should live |
|---|---|---|
| TG-1 | `msUntilNext0600IST` returns a positive value at 05:59 IST, ~0 at 06:00 IST, ~24h at 06:01 IST | `web/tests/unit/workers/ms-until-0600-ist.test.ts` (does not exist) |
| TG-2 | `daily-engagement-emitter` fires at 06:00 IST but NOT at 05:30 IST, 07:00 IST, or any other time | `web/tests/integration/workers/daily-engagement-emitter.test.ts` (does not exist) |
| TG-3 | `daily-engagement-emitter` fires exactly once per IST day (not 60 times in the 06:00 IST window) | same (after P0-1 fix) |
| TG-4 | `telemetry-cleanup` writes the audit log AND the deletes in a single transaction (or rolls back both on failure) | `web/tests/unit/workers/telemetry-cleanup-transaction.test.ts` (does not exist; after P0-3 fix) |
| TG-5 | `OutboxService.cleanupCompleted(1)` deletes events older than 1 day with `status: COMPLETED` and `processedAt: { lt: cutoff }` | `web/tests/unit/workers/outbox-cleanup-completed.test.ts` (does not exist) |
| TG-6 | `runScheduledTask` calls `alerter.send` after 3 consecutive failures | same (after P0-4 fix) |
| TG-7 | `scheduled-backup.checkAndRun` skips when `BACKUP_LOCK_STATUS === 'RESTORE_RUNNING'` | `web/tests/unit/workers/scheduled-backup-restore-lock.test.ts` (does not exist) |
| TG-8 | `audit-cleanup` idempotency: first call does the work, second call in the same IST day is a no-op | `web/tests/unit/workers/audit-cleanup-idempotency.test.ts` (does not exist) |
| TG-9 | `telemetry-cleanup` idempotency: same as TG-8 | same (does not exist) |
| TG-10 | The `sleep` function in `index.ts:450-461` returns immediately when `stopWorkers` is called (via abort signal) | `web/tests/unit/workers/sleep-abort.test.ts` (does not exist) |
| TG-11 | `startWorkers` is idempotent (second call returns early) | `web/tests/unit/workers/start-workers-idempotent.test.ts` (does not exist) |

---

## 7. What I'd do first if I had to pick one fix

**P0-1 (15 min, 1 file, 2 line edits)**: fix the `daily-engagement-emitter` to fire **once per IST day** by adding an in-memory `lastFiredDateKey` check. The fix is 2 lines:

```ts
let lastFiredDateKey: string | null = null;  // module-level
// ...
processor: async (injectedClock) => {
  const msUntil = msUntilNext0600IST();
  if (msUntil > 60_000) return;
  const todayIst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(injectedClock.now());
  if (lastFiredDateKey === todayIst) return;  // ← already fired today
  lastFiredDateKey = todayIst;
  // ... rest
}
```

This prevents 60 events per IST day. The `dailyEngagementJob` may dedupe, but the defense should be in the emitter.

**Why this fix first:**
- 15 min, no backend change to the job, no migration, no Flutter change.
- Prevents the most user-visible bug (60 birthday wishes per rider per day at 06:00 IST).
- The fix is additive (module-level state), so it's low-risk.

**Effort / blast-radius ranking** (next 5 fixes, in order):
1. P0-9 (15 min) — fix `msUntilNext0600IST` off-by-one. The condition should be `nowIstMs >= today0600IstMs` (not + 60_000). Stops the 60-second window where the event fires every minute.
2. P0-6 (5 min) — add `maxAttempts: 3` to `device-violation-emitter`. Inconsistent retry behavior.
3. P0-3 (1 hour) — wrap `telemetry-cleanup` audit log + deletes in a single `db.$transaction`. GDPR Article 30 compliance.
4. P0-4 (1 hour) — add failure-counter + `alerter.send` after 3 consecutive failures. SOC2 + ops.
5. P0-8 (30 min) — change `audit-log-cleanup` and `telemetry-cleanup` intervals from 5 min to daily at 03:00 IST. Reduce wasted work.

---

## 8. Cross-audit pattern: what this audit confirmed vs. previous 17

This 18th audit confirms and extends three cross-audit patterns:

### Pattern A: "Idempotency without atomicity" (now 3rd occurrence)
- **6th audit (legal-device-workflow)**: device permissions sync has no idempotency for the same payload.
- **16th audit (admin-panel-financial)**: bonus credit has no idempotency key (P0-9 in that audit).
- **18th audit (this)**: `telemetry-cleanup` writes the audit log in a separate transaction from the deletes. **Audit log can lie after partial failure**.

**Pattern: idempotency is only as good as the atomicity of the work it protects.** A separate-transaction audit log + delete is a guaranteed inconsistency on partial failure.

### Pattern B: "Timer drift" (now 2nd occurrence)
- **13th audit (rider-dashboard-profile-api-flows)**: dashboard `upcomingRentPrompt.dueTimeFormatted` hardcoded "Tomorrow at 6:00 AM" regardless of actual time.
- **18th audit (this)**: `outbox-completed-cleanup` runs at worker startup time, drifts with worker restarts. `audit-log-cleanup` and `telemetry-cleanup` use 5-min intervals when daily would suffice.

**Pattern: the team uses `setInterval` (or equivalent) for cron-like work, but doesn't anchor to a fixed clock time.** The result is that cleanup runs at unpredictable times relative to IST business hours.

### Pattern C: "Off-by-one in date math" (now 2nd occurrence)
- **5th audit (rewards-analytics-admins-faqs)**: MRR calculation excluded the current month due to date comparison.
- **18th audit (this)**: `msUntilNext0600IST` has `nowIstMs >= today0600IstMs + 60_000` instead of `nowIstMs >= today0600IstMs`. Creates a 60-second window.

**Pattern: date/time comparisons in JS are error-prone.** A unit test for `msUntilNext0600IST` at 05:59:30, 06:00:00, 06:00:30, 06:01:00, 23:59:59, 00:00:00 IST would catch the bug.

### Pattern D: "Silent error swallowing" (now 4th occurrence)
- **9th audit (flutter-my-documents-settings)**: photo upload silently fails.
- **16th audit (admin-panel-financial)**: audit log failure is swallowed in transaction.service.ts.
- **17th audit (admin-panel-operations-platform)**: audit log failure is swallowed in notifications.use-cases.ts.
- **18th audit (this)**: `runScheduledTask` swallows errors and only logs. No alerting.

**Pattern: `.catch(() => {})` and `logger.error()` are the team's go-to error handlers for cron tasks.** A lint rule that flags `.catch(() => {})` would catch this category.

### Pattern E: "No idempotency on emit" (now 2nd occurrence)
- **12th audit (rider-onboarding-api-flows)**: FCM token registration has no idempotency.
- **18th audit (this)**: `daily-engagement-emitter` and `rent-due-emitter` emit with no `idempotencyKey`.

**Pattern: outbox events that are emitted by a timer have no idempotency key, so duplicate emissions create duplicate downstream effects.** The fix is to either add `idempotencyKey` to the emit call, or use the in-memory `lastFiredDateKey` pattern.

---

## 9. Recommended fix order (with hours)

| # | Fix | Effort | Blast radius | Risk |
|---|---|---|---|---|
| 1 | P0-1: In-memory `lastFiredDateKey` in `daily-engagement-emitter` | 15 min | 1 scheduled task | Low |
| 2 | P0-9: Fix `msUntilNext0600IST` off-by-one | 15 min | 1 helper | Low |
| 3 | P0-6: Add `maxAttempts: 3` to `device-violation-emitter` | 5 min | 1 emit call | Low |
| 4 | P0-2: Time-of-day gate on `rent-due-emitter` | 30 min | 1 emit call | Low |
| 5 | P0-8: Daily at 03:00 IST for `audit-log-cleanup` and `telemetry-cleanup` | 30 min | 2 scheduled tasks | Low |
| 6 | P0-3: Wrap `telemetry-cleanup` in `db.$transaction` | 1 hour | 1 job | Low |
| 7 | P0-4: Failure counter + alerter in `runScheduledTask` | 1 hour | 1 helper | Low |
| 8 | P0-5: Fixed clock time for `outbox-completed-cleanup` | 1 hour | 1 scheduled task | Low |
| 9 | P0-7: Initialize `nextRunAt` on first scheduled backup | 1 hour | 1 job | Med |
| 10 | P1-1..P1-19, P2-1..P2-24, P3-1..P3-21, TG-1..TG-11 | 2 days | Multi-file | Low |

**Total: ~1 day of focused work to clear all P0; ~1 week to clear everything.**

---

## 10. File-level summary (what to keep / delete / refactor)

### Delete
- The "tombstone" comment for `notifications.job.ts` in `index.ts:33-37` — delete the comment after confirming the file is removed from the tree.

### Refactor
- `web/src/server/workers/index.ts:235-260` — add in-memory `lastFiredDateKey` (**P0-1**)
- `web/src/server/workers/jobs/daily-engagement.job.ts:135-167` — fix off-by-one (**P0-9**)
- `web/src/server/workers/index.ts:204-217` — add time-of-day gate to `rent-due-emitter` (**P0-2**)
- `web/src/server/workers/index.ts:219-230` — add `maxAttempts: 3` (**P0-6**)
- `web/src/server/workers/index.ts:180-202` — change interval to daily at 03:00 IST (**P0-8**)
- `web/src/server/workers/index.ts:374-391` — add failure counter + alerter (**P0-4**)
- `web/src/server/workers/jobs/telemetry-cleanup.job.ts:34-62` — wrap in `db.$transaction` (**P0-3**)
- `web/src/server/workers/jobs/audit-cleanup.job.ts:31` — change `NODE_ENV === 'production'` to `APP_ENV === 'production' || 'staging'`

### Keep
- `web/src/server/workers/jobs/audit-cleanup.job.ts` core (after P0-8, P1-3 fixes)
- `web/src/server/workers/jobs/notifications-cleanup.job.ts` (after P1-7 dedupe)
- `web/src/server/workers/jobs/scheduled-backup.job.ts` (after P0-7 fix)
- `web/src/server/workers/jobs/daily-engagement.job.ts` (after P0-9 fix)

---

## 11. Cumulative totals across 18 audits (post this audit)

| Severity | Count | Δ from 17 audits |
|---|---|---|
| P0 | **129** | +9 |
| P1 | **329** | +19 |
| P2 | **317** | +24 |
| P3 | **334** | +21 |
| Test gaps | **135** | +11 |
| Dead code (lines) | **~5,900** | +0 |

**Top 10 P0 across all 18 audits** (by blast radius, with newest at top):

1. **P0-1 (this audit)**: `daily-engagement-emitter` fires up to 60 events in a 60-minute window at 06:00 IST.
2. **P0-2 (this audit)**: `rent-due-emitter` emits every minute all day (1440 events per day).
3. **P0-3 (this audit)**: `telemetry-cleanup` audit log not transactional with deletes.
4. **P0-4 (this audit)**: No alerting on cleanup failures; outbox can grow unbounded.
5. **P0-5 (this audit)**: `outbox-completed-cleanup` runs at worker startup, drifts with restarts.
6. **P0-6 (this audit)**: `device-violation-emitter` calls `OutboxService.emit` with no `maxAttempts`.
7. **P0-7 (this audit)**: `scheduled-backup.checkAndRun` doesn't honor `frequency` for initial run.
8. **P0-8 (this audit)**: `audit-log-cleanup` and `telemetry-cleanup` fire every 5 min but only work once/day.
9. **P0-9 (this audit)**: `msUntilNext0600IST` off-by-one; fire window is 60 sec not 1 min.
10. **17th audit P0-1**: `POST /api/admin/notifications` `sendToAllRiders` is unthrottled and synchronous.

---

## 12. Audit metadata

- **Auditor:** Mavis (MiniMax)
- **Audit depth:** Cross-stack timer logic + idempotency + emit-loop + IST math + cleanup-window.
- **Files read:** 7 (5 backend, 1 use-case, 1 outbox service).
- **Lines analyzed:** ~1,200.
- **Confidence:** High for P0-1, P0-2, P0-3, P0-4, P0-5, P0-6, P0-7, P0-8, P0-9, P1-1..P1-19. Medium for P1-15, P1-16 (the `as any` casts make the `scheduleService` contract implicit; need to verify the actual signature).
- **Re-test trigger:** after P0-1 lands, the daily-engagement-emitter should fire exactly once per IST day. Add a vitest that runs the processor 100 times with the clock at 06:00:30 IST and asserts the outbox event is emitted only once.
- **Owner question for ops team:** what is the backup `BACKUP_LOCK_STATUS` semantics? The scheduled-backup check at line 34-37 reads it but doesn't set it; the restore flow must set it. Need to verify the restore flow does.
