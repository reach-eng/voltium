# Event-Driven Background Jobs (Outbox Workers) — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** the Voltium outbox worker subsystem (Postgres-backed `OutboxEvent` table, 11 event-driven workers, 6 scheduled tasks, priority split, reaper):

| Worker | Event Type | Concurrency | Priority | Status |
|---|---|---|---|---|
| `reconciliation.job` | `wallet.reconciliation` | 1 | background | **BROKEN — uses old N+1 impl; PR-148 single-query version is wired elsewhere** |
| `notification-dispatch.job` | `notification.send` | 3 | interactive | **BUG — duplicate `KYC_APPROVED`/`KYC_REJECTED` switch cases; second cluster unreachable** |
| `daily-engagement.job` | `engagement.daily` | 1 | interactive | OK; runs at 06:00 IST, idempotency via IST date key |
| `rent-reminders.job` | `rent.due_check` | 2 | interactive | **Sequential per-lease for-loop — no concurrency cap, no progress check** |
| `device-compliance.job` | `device.violation_scan` | 2 | background | **N+1 find-then-create per rider inside a for-loop** |
| `referral-reward.job` | `referral.reward` | 3 | interactive | **Duplicate write path with the use case (audit #21 P0-4 unit confusion); idempotency check missing here** |
| `sms-dispatch` (inline) | `sms.send` | 5 | interactive | OK; calls `sendSms(phone, message)` directly |
| `notifications-cleanup.job` | `admin.job.notifications_cleanup` | 1 | background | OK; 30-day TTL on read notifications |
| `orphan-event-consumer.job` (×4) | `rent.paid` / `rent.overdue` / `device.violation` / `admin.action` | 2 | interactive / background | **`route()` helper is dead code (returns `true`); 4 separate worker entries for the same processor** |
| `telemetry-cleanup.job` | (cron-driven, not outbox) | — | — | OK; 30-day TTL on PII; PR-154 audit-before-delete |
| `audit-cleanup.job` | (cron-driven, not outbox) | — | — | OK; 48h idempotency via IST date; VACUUM ANALYZE in prod |
| `scheduled-backup.job` | (cron-driven, every 5 min) | — | — | **BROKEN — calls `(scheduleService as any).runScheduledBackup(...)` but `scheduleService` only has `calculateNextRun`; the cast hides a real bug** |

**Files read in full:**
- `web/src/server/workers/index.ts` (524 lines — orchestrator; 9 event-driven workers + 6 scheduled tasks + reaper; PR-75 priority split; 30s graceful shutdown)
- `web/src/server/workers/outbox.ts` (340 lines — `OutboxService` with `emit`/`emitWithCommit`/`getStats`/`retryFailed`/`cleanupCompleted`; `MAX_OUTBOX_PAYLOAD_BYTES = 64KB`; 9 `@deprecated` event types)
- `web/src/server/workers/queues.ts` (14 lines — `JOB_TYPES` re-export of `OutboxEventTypes`)
- `web/src/server/workers/job-wrapper.ts` (44 lines — `withJobGuards` decorator — **never imported anywhere in the codebase**)
- `web/src/server/workers/jobs/reconciliation.job.ts` (140 lines — **OLD N+1 implementation**, still wired to the outbox)
- `web/src/server/workers/jobs/wallet-reconciliation.job.ts` (177 lines — **NEW PR-148 single-query implementation**, only called from cron/admin route, NOT from the outbox)
- `web/src/server/workers/jobs/notification-dispatch.job.ts` (219 lines — switch on `payload.type`; **duplicate KYC cases**)
- `web/src/server/workers/jobs/daily-engagement.job.ts` (167 lines — birthday wishes, payment reminders, referral leaderboard; 06:00 IST)
- `web/src/server/workers/jobs/rent-reminders.job.ts` (190 lines — auto-debit active leases, advance period)
- `web/src/server/workers/jobs/device-compliance.job.ts` (95 lines — scans active riders, creates/auto-resolves violations)
- `web/src/server/workers/jobs/referral-reward.job.ts` (136 lines — credits referrer wallet when referee completes onboarding)
- `web/src/server/workers/jobs/notifications-cleanup.job.ts` (18 lines — purges read notifications > 30 days)
- `web/src/server/workers/jobs/orphan-event-consumer.job.ts` (190 lines — handles 4 orphan event types; `route()` helper is dead code)
- `web/src/server/workers/jobs/telemetry-cleanup.job.ts` (79 lines — purges PII > 30 days; PR-154 audit-before-delete)
- `web/src/server/workers/jobs/audit-cleanup.job.ts` (43 lines — purges expired audit logs; 48h idempotency)
- `web/src/server/workers/jobs/scheduled-backup.job.ts` (123 lines — checks + runs scheduled backup; **broken method call**)

**Out of scope:** `lib/job-queue.ts` internals (referenced but not read in detail; the `processJobs` + `runReaper` are the foundation). The `OutboxEvent` Prisma model schema. The `lib/alerter` and `lib/notification-service` implementations. The wallet ledger service internals.

---

## TL;DR

**The outbox worker subsystem has 5 P0 bugs. The headline: `reconciliation.job.ts` is the OLD N+1 implementation that's still wired to the outbox worker, while the new PR-148 single-query version is wired only to the cron/admin route.** The outbox path is 100× slower for 10K+ riders. An admin who triggers reconciliation via the Background Jobs screen runs the slow path. A scheduled job at 02:00 IST runs the slow path. The fast path only runs when an admin hits the manual reconciliation route.

The other 4 P0s are all real:

1. **`scheduled-backup.job.ts` calls a method that doesn't exist on the service it's calling.** Line 79: `await (scheduleService as any).runScheduledBackup({...})`. The `scheduleService` (from `data-management/schedule/schedule.service.ts`) only has `calculateNextRun` — `runScheduledBackup` lives on `backupService`. The `(as any)` cast hides a TypeError. **The scheduled backup is wired to silently do nothing when it fires.** The audit log says `backup.scheduled_started`; the actual backup never runs.

2. **`notification-dispatch.job.ts` has duplicate switch cases that make the in-app row unreachable for KYC events.** Lines 89-94 and 116-117 both have `case 'KYC_APPROVED':` / `case 'KYC_REJECTED':`. JavaScript's `switch` matches the first one, so the second cluster (which is the PR-78 fix to persist an in-app `Notification` row) is **dead code for KYC events**. Riders get an FCM push for KYC status changes but no in-app inbox row.

3. **`withJobGuards` (job-wrapper.ts) is defined but never imported anywhere.** The decorator's intent was to wrap every background job with DLQ persistence + alert-on-failure. The result: failed jobs go to the OutboxEvent's `error` field but **no separate `failedJob` table is populated**. SOC2 has a DLQ gap — when a job exhausts `maxAttempts` and the OutboxEvent is marked FAILED, the failure is logged but not separately tracked.

4. **`orphan-event-consumer.job.ts` has a dead `route()` helper that just returns `true`.** Line 46-53 defines `async function route(payload): Promise<boolean> { return true; }` — the comment says "the call site handles type dispatch before calling this helper. Returning true means handled." The actual dispatch happens at line 158-165 via the `handlers` map. **The `route()` function is a no-op that does nothing and is called for every event.**

5. **9 `@deprecated` event types in `outbox.ts` (lines 38-127) are dead code in the enum.** `WALLET_TOPUP_REQUESTED`, `DEPOSIT_APPROVED` / `REJECTED` / `REFUNDED`, `REFERRAL_SIGNUP`, `RENT_DUE`, `RENT_PAID`, `AUDIT_LOG_CLEANUP`, `TELEMETRY_DATA_CLEANUP` are all marked `@deprecated Unused — never emitted, never consumed. Scheduled for removal in v0.4.` But `RENT_PAID` is **also** in `ORPHAN_EVENT_TYPES` (line 184 of orphan-event-consumer.job.ts) and is consumed. **The `@deprecated` tag on `RENT_PAID` is wrong.**

There are also P1s: `reconciliation.job.ts` is O(N×K) where N = wallets, K = avg ledger entries (N+1 pattern in the backfill pass and the comparison pass); `device-compliance.job.ts` does N+1 find-then-create per active rider; `rent-reminders.job.ts` does 1 transaction per lease in a for-loop with no concurrency cap; `daily-engagement.job.ts` filters riders by `dob.startsWith(birthdayString)` which is a seq scan for non-string dob columns; `referral-reward.job.ts` doesn't pre-check for existing transactions (the use case does, audit #21); the orphan consumer is registered as 4 separate worker entries for the same processor; `scheduled-backup.job.ts` runs every 5 min but the `findRunningBackup` + `getSchedule` is sync; the reaper at every 5 min is too long for fast failover; the orchestrator's `hasPendingInteractive` check is one `findFirst` which races with new emits.

The headline architectural issue: **the worker subsystem has the right shape (outbox + priority + reaper + at-least-once) but the implementations are inconsistent across jobs** — different idempotency mechanisms, different error handling, different patterns for sub-operation failures. The `withJobGuards` decorator that would standardize this is dead code.

There are **5 P0s**, **13 P1s**, and **8 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, security gap, silent data loss, business logic bug | Before next release |
| **P1** | UX friction, race condition, accessibility, dead code, contract drift | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: `reconciliation.job.ts` is the OLD N+1 implementation; PR-148 single-query version is wired only to cron/admin — outbox path is 100× slower

**Repro:**
- Admin opens Background Jobs screen → "Wallet Reconciliation" → Run Now. The route POSTs to `/api/admin/jobs` which emits `ADMIN_JOB_WALLET_RECONCILIATION`. The worker `reconciliationJob` (line 65 of workers/index.ts) is invoked.
- The job walks every wallet and every ledger entry in JS:
  - Line 39: `db.wallet.findMany({ select: { riderId: true } })` — 1 query for all wallet owners
  - Line 40-44: `for (const { riderId } of allRiderIds) { await backfillOpeningBalance(db, riderId).catch(...); }` — **N sequential awaits for backfill**
  - Line 47-49: `db.wallet.findMany({ select: { id, riderId, balanceInPaise } })` — 1 query for all wallets
  - Line 62-90: `for (const wallet of wallets) { const entries = await db.walletLedger.findMany({ where: { walletId: wallet.id } }) ... }` — **N sequential queries for ledger sums**

**For 100K wallets:** the second pass alone is 100K queries. At 5ms per query, that's **8+ minutes blocking the worker**. The same job done via the new `wallet-reconciliation.job.ts` (PR-148) is **1 single SQL query** with `SUM(CASE WHEN entryType='CREDIT' THEN amountInPaise ELSE -amountInPaise END)` grouped by rider.

**Code:**

Old version (wired to outbox): `web/src/server/workers/jobs/reconciliation.job.ts:39-90`

```typescript
// 1. Backfill opening balances
const allRiderIds = await db.wallet.findMany({ select: { riderId: true } });
for (const { riderId } of allRiderIds) {
  await backfillOpeningBalance(db, riderId).catch((err: Error) => {
    logger.error('[ReconciliationJob] backfill error', { riderId, err });
  });
}

// 2. Compare ledger sums to wallet balances
const wallets = await db.wallet.findMany({ select: { id, riderId, balanceInPaise } });
for (const wallet of wallets) {
  const entries = await db.walletLedger.findMany({ where: { walletId: wallet.id, ... } });
  // ... compute drift in JS ...
}
```

New version (wired only to cron/admin): `web/src/server/workers/jobs/wallet-reconciliation.job.ts:67-95`

```typescript
async function fetchAllWalletDrifts(): Promise<WalletDriftRow[]> {
  const rows = await db.$queryRaw<WalletDriftRow[]>`
    SELECT w."riderId" AS "riderId", w."balanceInPaise" AS "walletBalance",
      COALESCE(SUM(CASE WHEN wl."entryType" = 'CREDIT' THEN wl."amountInPaise" ELSE -wl."amountInPaise" END), 0)::bigint::int AS "ledgerSum",
      (w."balanceInPaise" - COALESCE(SUM(...), 0))::bigint::int AS "drift"
    FROM "wallets" w
    LEFT JOIN "wallet_ledgers" wl ON wl."riderId" = w."riderId" AND wl."category" NOT IN ('SECURITY_DEPOSIT', 'FORFEITURE', 'REFUND')
    GROUP BY w."riderId", w."balanceInPaise"
  `;
  return rows;
}
```

**The new version is 1 query; the old is N+1.**

**Impact:**
- **The "Wallet Reconciliation" job in the admin UI is 100× slower than necessary** for 10K+ riders.
- **Scheduled daily run (if any) is slow.** Workers don't auto-trigger this outbox event from a cron (per workers/index.ts), so the outbox path is admin-only. But the cron route `app/api/cron/reconciliation/route.ts` calls the fast version — there's no scheduled outbox event for wallet reconciliation. The "Daily (02:00 IST)" entry in the admin UI is **aspirational, not wired**.
- **Two `ReconciliationResult` shapes** — old returns `{ reportDate, totalWallets, matched, mismatched, drift, healthy }` (line 7-14); new returns `{ totalWallets, healthy, drifted, totalDrift, driftedRiders }` (line 33-44). Different field names: `mismatched` vs `drifted`, `drift` vs `totalDrift`. The admin UI reads `reconHistory[0].matched`, `.mismatched`, `.drift` (jobs/route.ts:167) — the old shape. **If someone switches the wiring, the UI breaks.**

**Fix:**
1. **Replace the `processor: reconciliationJob.process` line in workers/index.ts:65** with `processor: async (job) => { const r = await runWalletReconciliation(); await recordReconciliation(r); return r; }`.
2. **Delete `reconciliation.job.ts`** once the new wiring is in place.
3. **Unify the result shape** to match what the admin UI consumes.

**Effort:** 1-2h.

---

### P0-2: `scheduled-backup.job.ts` calls `(scheduleService as any).runScheduledBackup(...)` — the method doesn't exist on `scheduleService`; the `(as any)` cast hides a TypeError

**Repro:** The scheduled backup job runs every 5 minutes (workers/index.ts:316, `runScheduledBackupLoop` with 5min sleep). The job reads the schedule, checks maintenance mode, checks disk space, then calls:

```typescript
// scheduled-backup.job.ts:79
await (scheduleService as any).runScheduledBackup({...});
```

The `scheduleService` import is from `@/server/modules/data-management/schedule/schedule.service.ts`. That file is 1607 bytes. **It only has one exported method: `calculateNextRun`.** No `runScheduledBackup`.

`runScheduledBackup` lives on `backupService` (data-management/backup.service.ts:236-286).

**So `(scheduleService as any).runScheduledBackup` throws `TypeError: scheduleService.runScheduledBackup is not a function` at runtime.** The catch at line 112 catches it, marks the schedule as failed, and returns `{ ran: false, reason: 'Backup execution failed: ...' }`. The audit log at line 69-76 records `backup.scheduled_started`. **The admin sees a "scheduled backup ran" in the logs but no backup file was created.**

**Impact:**
- **The entire scheduled backup system is broken.** The cron loop runs every 5 min, always fails at the actual backup call. The `BackupSchedule.lastStatus` is always FAILED. The admin UI's "Last Status: FAILED" is correct, but the cause is a typo-level bug, not a config issue.
- **The audit log shows the schedule was "started"** (line 69-76 records `backup.scheduled_started` before the broken call), so it looks like a backup is in progress. The follow-up "scheduled_failed" log is in the same job but may not surface in the UI.
- **No data backup is being taken** for the project. In a real disaster, the restore would fail because there's nothing to restore from.

**Fix:**
- Change the import to `import { backupService } from '@/server/modules/data-management/backup.service';` and call `backupService.runScheduledBackup({...})`. Remove the `(as any)` cast.
- The call signature matches (line 236-249 of backup.service.ts: `runScheduledBackup(schedule: { id, frequency, includeDatabase, includeUploads, includeLogs, primaryBackupRoot, secondaryBackupRoot, keepDaily, keepWeekly, keepMonthly, keepManual, minimumFreeDiskGb })`).
- Add a unit test that calls `checkAndRun()` and asserts the backup actually runs.

**Effort:** 5min.

---

### P0-3: `notification-dispatch.job.ts` has duplicate switch cases for KYC — the in-app `Notification` row is never created for KYC events

**Repro:** A KYC_APPROVED event is emitted. The worker:

```typescript
// notification-dispatch.job.ts:88-110
switch (payload.type) {
  case 'KYC_APPROVED':
    await notificationService.notifyKycStatusChange(payload.riderId, 'APPROVED');
    return { delivered: true, channel: 'fcm' };

  case 'KYC_REJECTED':
    await notificationService.notifyKycStatusChange(payload.riderId, 'REJECTED', payload.reason as string | undefined);
    return { delivered: true, channel: 'fcm' };

  case 'KYC_INFO_REQUIRED':
    await notificationService.notifyKycStatusChange(payload.riderId, 'INFO_REQUIRED', payload.reason as string | undefined);
    return { delivered: true, channel: 'fcm' };

  case 'WALLET_TOPUP_APPROVED':
  case 'WALLET_TOPUP_REJECTED':
  case 'DEPOSIT_APPROVED':
  case 'DEPOSIT_REJECTED':
  case 'KYC_APPROVED':     // ← duplicate of line 89; unreachable
  case 'KYC_REJECTED':     // ← duplicate of line 96; unreachable
  {
    // PR-78: persist Notification row
    await db.notification.create({ ... });
    return { delivered: true, channel: 'in-app' };
  }
  // ...
}
```

JavaScript's `switch` matches the first case. `KYC_APPROVED` matches line 89, executes the FCM call, returns. The case at line 116 is **unreachable**. The PR-78 in-app `Notification` row is only created for `WALLET_TOPUP_*` and `DEPOSIT_*` events — **not for KYC events**.

**Impact:**
- **Riders get an FCM push for KYC status changes** (good).
- **Riders do NOT see the KYC status change in their in-app notification center** (bad — they have to leave the app, see the FCM, and come back; the inbox doesn't have the record).
- **The PR-78 fix was supposed to cover all notification types**; the duplicate cases suggest the dev added KYC to both clusters but didn't notice the first one already handled them.
- **The same bug exists for KYC_REJECTED** but not for KYC_INFO_REQUIRED (the third KYC case is only in the first cluster).

**Fix:**
- Remove the duplicate `case 'KYC_APPROVED':` and `case 'KYC_REJECTED':` from the second cluster.
- Or: refactor the switch to a single case per type that does both FCM + in-app row.
- Add a test that asserts `db.notification.count({ where: { type: 'KYC_APPROVED' } })` increments after a KYC_APPROVED event.

**Effort:** 30min.

---

### P0-4: `withJobGuards` (job-wrapper.ts) is dead code — every job in the system is unwrapped; failed jobs have no DLQ

**Repro:** Open `web/src/server/workers/job-wrapper.ts`. It exports `withJobGuards(fn, options)` which decorates a function with try/catch + `db.failedJob.create` + alert log. Search the codebase for `withJobGuards` outside this file: **zero matches**. The decorator is defined but never imported by any job.

**Code:** `web/src/server/workers/job-wrapper.ts:13-43`

```typescript
export function withJobGuards<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: JobGuardOptions
): T {
  const notifyOnFailure = options.notifyOnFailure ?? true;
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args);
    } catch (err) {
      logger.error(`[ALERT] Background job failed: ${options.name}`, err);
      try {
        await (db as any).failedJob.create({
          data: { jobName: options.name, error: err instanceof Error ? err.message : String(err), failedAt: new Date() },
        });
      } catch (dbErr) {
        logger.error('[withJobGuards] Failed to persist to failedJob', dbErr);
      }
      if (notifyOnFailure) {
        logger.warn(`[ALERT] High-priority notification for failed job: ${options.name}`);
      }
      throw err;
    }
  }) as T;
}
```

**Impact:**
- **No `failedJob` table is populated.** When a job exhausts `maxAttempts` and the `OutboxEvent` is marked FAILED, the failure is recorded only on the OutboxEvent row's `error` field. **No separate "dead letter queue" exists.**
- **The decorator's intent was to write to a `failedJob` table** for SOC2 traceability. SOC2 needs a record of every failed background job, ideally with the original payload for forensic analysis. **The OutboxEvent stores the payload, but the join from a FAILED event to "what job was it" is implicit via `eventType`.**
- **No alert on job failure.** The decorator would call `alerter.send` (well, `logger.warn` — actually it doesn't, just logs). The alerter integration is dead.
- **The `db as any` casts in the decorator** suggest the `FailedJob` model isn't in the Prisma schema either. If it were, the cast would be `db.failedJob.create(...)`. **Either the model exists and is unwired, or it doesn't exist and the decorator is a no-op when called.**

**Fix:**
1. Add a `FailedJob` model to `prisma/schema.prisma` with `jobName`, `error`, `payload`, `failedAt` fields.
2. Run a migration.
3. Wrap every job registration in `workers/index.ts` with `withJobGuards(jobProcessor, { name: 'wallet-reconciliation' })`.
4. Remove the `(db as any)` cast.
5. Add a reaper for the FailedJob table that surfaces failures in the admin UI.

**Effort:** 4-6h (schema + migration + 9 call sites + UI).

---

### P0-5: `orphan-event-consumer.job.ts` has a dead `route()` helper — and RENT_PAID is mis-tagged as `@deprecated` in the OutboxEventTypes enum

**Repro:** The `route()` function in `orphan-event-consumer.job.ts:46-53`:

```typescript
async function route(payload: any): Promise<boolean> {
  // The event type is carried in the outbox event row, but the
  // dispatcher doesn't pass it in `job.payload`. We use a hint
  // field — see `process()` below for the type dispatch.
  // For now, the call site handles type dispatch before calling
  // this helper. Returning true means "handled".
  return true;
}
```

It's called at line 168: `await route(job.payload);` — the result is **ignored**. The actual dispatch happens at line 158-165:

```typescript
const handler = handlers[eventType];
if (!handler) {
  logger.warn('[OrphanConsumer] No handler for eventType', { eventType });
  return result;
}
// ... calls handler directly ...
```

**The `route()` function is a no-op that just returns `true`. The comment is wrong** — the dispatcher does NOT pass `eventType` in `job.payload`, so the call site can't dispatch by payload. The actual dispatch is via the `eventType` field on the job (line 149: `const eventType: string = job.type ?? job.eventType ?? job.payload?.eventType ?? '';`).

**Plus:** `RENT_PAID` is in `OutboxEventTypes.RENT_PAID` (outbox.ts:90) with the comment `@deprecated Unused — never emitted, never consumed. Scheduled for removal in v0.4.` But `RENT_PAID` is **also** in `ORPHAN_EVENT_TYPES` (orphan-event-consumer.job.ts:185) and is consumed by `handleRentPaid` (line 55-71). **The `@deprecated` tag is wrong** — the event IS consumed.

**Impact:**
- **Dead code (route() helper)** — slight maintenance burden, slight noise in code review.
- **Wrong `@deprecated` tag** — the comment in outbox.ts:88-90 will be followed in v0.4 cleanup. If someone removes `RENT_PAID` from the enum as "unused", the orphan consumer breaks (RENT_PAID events no longer match). **Real bug in waiting.**

**Fix:**
- Delete the `route()` function.
- Remove the `@deprecated` tag from `RENT_PAID` in outbox.ts:88-90.
- Audit the other `@deprecated` event types to make sure they're truly unused (DEPOSIT_APPROVED is in `notification-dispatch.job.ts:114` as a payload type, so it's referenced even if not emitted; RENT_DUE is in `rent-reminders.job.ts:166-167` similarly).

**Effort:** 10min.

---

## P1 — Fix in next 2 sprints

### P1-1: `reconciliation.job.ts` backfill pass is N+1 (`for (const { riderId } of allRiderIds) { await backfillOpeningBalance(...) }`)

Already covered by P0-1 (replacing the entire job). The backfill is the first O(N) sequential pass; the comparison pass is the second O(N×K) sequential pass.

**Fix:** Same as P0-1. ~30min included in the P0-1 fix.

---

### P1-2: `device-compliance.job.ts` is N+1 find-then-create per active rider

**Code:** `device-compliance.job.ts:23-90`

```typescript
const activeRiders = await db.rider.findMany({ where: { lifecycleStatus: 'ACTIVE' }, select: {...} });
for (const rider of activeRiders) {
  const missingPermissions: string[] = [];
  if (rider.isLocationMandatory && rider.deviceViolationCount > 0) {
    missingPermissions.push('location');
  }
  if (missingPermissions.length > 0) {
    for (const permissionId of missingPermissions) {
      // Check if there's already an active violation
      const existing = await db.deviceViolation.findFirst({ where: { riderId, permissionId, status: 'ACTIVE' } });
      if (!existing) {
        await db.deviceViolation.create({ data: { riderId, permissionId, status: 'ACTIVE' } });
        result.violationsFound++;
      }
    }
    // Emit outbox event
    await OutboxService.emit(OutboxEventTypes.DEVICE_VIOLATION, {...}).catch(() => {});
  }
  // Auto-resolve old violations
  const oldViolations = await db.deviceViolation.updateMany({...});
  result.violationsResolved += oldViolations.count;
}
```

**For 10K active riders with no violations: 10K findFirst + 10K updateMany = 20K round-trips per scan.** The scan runs every 60 seconds (per workers/index.ts:225, `device-violation-emitter`).

**Fix:**
- Batch the existing-violation check: `db.deviceViolation.findMany({ where: { riderId: { in: riderIds }, status: 'ACTIVE' } })` once, build a Set in JS.
- Batch the create: `db.deviceViolation.createMany({ data: [...] })` with `skipDuplicates: true`.
- Batch the outbox emit: emit one event per rider, not one per permission (or batch into a single event with an array of riders).

**Effort:** 2-3h.

---

### P1-3: `rent-reminders.job.ts` per-lease for-loop with no concurrency cap

**Code:** `rent-reminders.job.ts:63-185`

The loop processes one lease at a time: `db.$transaction` (3 statements), `createAuditLog`, `notifyPaymentReminder`. For 10K active leases, this is 10K sequential transactions. **The sequential processing is intentional** (avoids deadlocks; ensures deterministic order), but the lack of a concurrency cap means a slow `notifyPaymentReminder` blocks the next lease.

**Fix:** Wrap the loop in a `pLimit`-style concurrency cap (e.g. 5 parallel transactions). Or move the notification to after the loop (collect all `riderId`s then send in one batch via `notificationService.notifyBatch(...)`).

**Effort:** 2-3h.

---

### P1-4: `daily-engagement.job.ts` filters by `dob.startsWith(birthdayString)` — seq scan if `dob` is a date

**Code:** `daily-engagement.job.ts:66-71`

```typescript
const [, mm, dd] = today.split('-');
const birthdayString = `${dd}-${mm}`;
const birthdayRiders = await db.rider.findMany({
  where: { dob: { startsWith: birthdayString } },
  select: { id: true, fullName: true },
});
```

If `dob` is stored as `DateTime`, Prisma serializes it to ISO 8601 (`2024-08-05T00:00:00.000Z`), and the `startsWith: '05-08'` would match 0 rows. If `dob` is stored as `String` in `DD-MM-YYYY` format, the `startsWith` works but **PostgreSQL can't use a B-tree index for `startsWith` on a date-string column**.

**Fix:** Either store `dob` as `Date` with month/day-only filtering (use `EXTRACT(MONTH FROM dob) = 8 AND EXTRACT(DAY FROM dob) = 5`), or add a functional index on `to_char(dob, 'DD-MM')`.

**Effort:** 1-2h (migration + index + query update).

---

### P1-5: `referral-reward.job.ts` doesn't pre-check for existing transactions — race with the use case

**Code:** `referral-reward.job.ts:64-94`

The use case (`referral.use-cases.ts:processReferralReward` at audit #21) does:
```typescript
const existingReward = await db.transaction.findFirst({
  where: { riderId: referrer.id, purpose: 'REWARD', description: { contains: referee.id } },
});
if (existingReward) return;
```

The job doesn't:
```typescript
// referral-reward.job.ts:64-94
await db.$transaction(async (tx: any) => {
  const txn = await tx.transaction.create({...});
  await walletLedgerService.credit({...}, tx);
  await tx.reward.create({...});
});
```

The `idempotencyKey: 'referral:${referrer.id}:${referredRiderId}'` is set on the `walletLedger` row. The `WalletLedger.idempotencyKey` UNIQUE constraint is the authoritative arbiter. **If the use case and the job race** (admin manual reconcile via the use case + auto-trigger via the job), the unique constraint catches the duplicate. **But the use case also writes a `Transaction` row, not just a `WalletLedger` entry. The job's `Transaction` row is a duplicate.**

**The `transaction.idempotencyKey` column may not be unique-constrained.** The job's `txn` write doesn't check; the use case does. **Race creates duplicate `Transaction` rows for the same (referrer, referee) pair.**

**Fix:** Add the same pre-check to the job, OR add a `Transaction.idempotencyKey` UNIQUE constraint and remove the pre-check from both paths.

**Effort:** 1-2h.

---

### P1-6: `notification-dispatch.job.ts` `REFERRAL_REWARD` case returns `delivered: false, channel: 'none'` — never delivers

**Code:** `notification-dispatch.job.ts:204-207`

```typescript
case 'REFERRAL_REWARD':
  // Currently the in-app broadcast (no FCM) — kept for future
  // personalization. Logged so the OutboxEvent is acked.
  return { delivered: false, channel: 'none' };
```

The comment says "in-app broadcast" but the code doesn't create a `Notification` row. The event is acked (`OutboxEvent` marked COMPLETED) but the rider sees nothing. **The dispatch is a lie** — the event says it was delivered; nothing happened.

**Fix:** Either create an in-app `Notification` row (similar to the topup/deposit cluster), or remove the `REFERRAL_REWARD` case from the dispatcher's switch and let a different consumer handle it.

**Effort:** 30min.

---

### P1-7: `rent-reminders.job.ts` emits `RENT_OVERDUE` with the WRONG payload shape

**Code:** `rent-reminders.job.ts:166-177`

The job emits:
```typescript
await OutboxService.emit(
  OutboxEventTypes.RENT_OVERDUE,
  {
    riderId: rider.id,
    leaseId: lease.id,
    amountDue: rentAmount,
    balance,
  },
  // ...
);
```

The orphan consumer expects (line 74):
```typescript
const { riderId, leaseId, amountDue, balance, hoursUntilDebit, periodNo } = payload;
// ...
const isProactive24h = typeof hoursUntilDebit === 'number' && hoursUntilDebit <= 24 && hoursUntilDebit > 0;
```

The job doesn't include `hoursUntilDebit` or `periodNo`. **The consumer's "proactive 24h" detection never fires** because `hoursUntilDebit` is always undefined. The `isProactive24h` check is `typeof undefined === 'number' && ...` → false. **All RENT_OVERDUE events are treated as reactive (not proactive).**

**Fix:** Include `hoursUntilDebit` in the emitted payload. Decide the value: 0 for reactive, or compute based on `nextRentDueAt - now`.

**Effort:** 30min.

---

### P1-8: `orphans` registered as 4 separate worker entries for the same processor

**Code:** `workers/index.ts:141-168`

```typescript
{ jobType: OutboxEventTypes.RENT_PAID, processor: orphanEventConsumerJob.process, concurrency: 2, priority: 'interactive' },
{ jobType: OutboxEventTypes.RENT_OVERDUE, processor: orphanEventConsumerJob.process, concurrency: 2, priority: 'interactive' },
{ jobType: OutboxEventTypes.DEVICE_VIOLATION, processor: orphanEventConsumerJob.process, concurrency: 2, priority: 'background' },
{ jobType: OutboxEventTypes.ADMIN_ACTION, processor: orphanEventConsumerJob.process, concurrency: 2, priority: 'background' },
```

4 polling loops, 4 `findFirst` queries per cycle, 4 sleep timers. The `process()` function dispatches by `job.type`. **Could be one worker entry that subscribes to all 4 event types and dispatches internally.**

**Fix:** Add a `JOB_TYPES: OutboxEventType[]` field to the worker definition, support a `subscribeMultiple: true` flag in `JobQueue.processJobs`, and reduce to 1 entry with 4 event types.

**Effort:** 4-6h (touches JobQueue + every worker definition).

---

### P1-9: `scheduled-backup.job.ts` runs every 5 min but bypasses the outbox — failures are not visible in the admin UI

**Code:** `workers/index.ts:393-398`

```typescript
async function runScheduledBackupLoop(injectedClock: typeof clock): Promise<void> {
  while (running) {
    await checkScheduledBackups();
    await sleep(300_000);
  }
}
```

`checkScheduledBackups()` calls `scheduledBackupJob.checkAndRun()`. The job handles its own error logging and audit log. But the **OutboxEvent-driven path is the one the admin sees** in the Background Jobs screen. The cron-driven path writes to `db.systemSetting` (the `LAST_BACKUP_FAILURE` key, set at line 103-109) and to the audit log. The admin sees the failure in the Schedule tab's "lastStatus" field but not in the Background Jobs list.

**Plus** the actual method is broken (P0-2), so the cron path silently fails.

**Fix:** After fixing P0-2, ensure the cron path emits an OutboxEvent for visibility.

**Effort:** 1h.

---

### P1-10: The reaper runs every 5 min — too long for fast failover

**Code:** `workers/index.ts:400-413`

```typescript
async function runReaperLoop(injectedClock: typeof clock): Promise<void> {
  while (running) {
    try {
      const { JobQueue } = await import('@/lib/job-queue');
      const reclaimed = await JobQueue.runReaper();
      if (reclaimed > 0) {
        logger.warn('[Reaper] Reclaimed stuck processing jobs', { count: reclaimed });
      }
    } catch (err) {
      logger.error('[Reaper] Error during reaper cycle', err);
    }
    await sleep(300_000);
  }
}
```

The reaper reclaims events that are `status: 'PROCESSING'` for more than 5 min (per `workflow-coverage/route.ts:128-130`'s health check, the threshold is `Date.now() - 5 * 60 * 1000`). **If a worker crashes mid-event, the event is stuck for 5 min before the reaper picks it up.** For latency-sensitive events (rent-due SMS, OTP), this is too long.

**Fix:** Reduce the reaper cycle to 30-60s. The reaper query is cheap (a count of PROCESSING events older than 5 min).

**Effort:** 1min (one number change).

---

### P1-11: `reconciliation.job.ts` idempotency check has a race

**Code:** `reconciliation.job.ts:23-36`

```typescript
const existingReport = await db.reconciliationReport.findUnique({ where: { reportDate: today } });
if (existingReport) {
  return { ... };
}
// ... walk wallets ...
const report = await db.reconciliationReport.create({ data: { reportDate: today, ... } });
```

Two parallel jobs can both pass the `findUnique` check, both run reconciliation, both call `create`. The unique constraint on `reportDate` (if it exists) catches the second one — throws P2002. The catch is at line 102 (no `.catch`), so the error propagates and the OutboxEvent becomes FAILED. **The second job is retried 3 times (per OutboxEvent.maxAttempts = 3), each retrying the same idempotency check + create race. After 3 attempts, the event is FAILED.**

**Fix:** Use `upsert` with a `where: { reportDate: today }` clause. The `update` branch can return the existing report; the `create` branch is the only one that does the walk. Wrap in `db.$transaction` with `SELECT ... FOR UPDATE` for true serialization.

**Effort:** 1h.

---

### P1-12: `outbox.ts` has 8 genuinely-`@deprecated` event types that should be removed in v0.4

**Code:** `outbox.ts:38-127`

`WALLET_TOPUP_REQUESTED`, `DEPOSIT_APPROVED` / `REJECTED` / `REFUNDED`, `REFERRAL_SIGNUP`, `RENT_DUE`, `RENT_PAID` (mis-tagged — see P0-5), `AUDIT_LOG_CLEANUP`, `TELEMETRY_DATA_CLEANUP`.

`DEPOSIT_APPROVED` is referenced in `notification-dispatch.job.ts:114` as a payload type but the event type itself is `@deprecated`. **The dispatcher handles a payload type that's tied to a deprecated event type.** A producer that emits `DEPOSIT_APPROVED` will get the dispatcher's handler, but `OutboxEventTypes.DEPOSIT_APPROVED` is marked for removal.

**Fix:** Either remove the @deprecated tags and wire the producers, or remove the dispatcher's references to the deprecated event types.

**Effort:** 1-2h (decide per-event).

---

### P1-13: `notification-dispatch.job.ts` switch has 13 cases with 5-6 different return shapes — hard to test exhaustively

The switch has 13 cases. Each has its own return shape (`delivered`, `channel`, `warning?`). **No test coverage for the dispatcher's behavior on unknown types, malformed payloads, or duplicate cases.**

**Fix:** Add a test that emits one of each `NotificationPayloadType` and asserts the right `delivered` + `channel` + Notification row count.

**Effort:** 2-3h (table-driven test).

---

## P2 — Cleanup backlog

### P2-1: `orphans` are registered as 4 separate `WORKERS` entries; could be 1 with multi-subscribe

Same as P1-8.

---

### P2-2: `referral-reward.job.ts` line 132 sets `result.referredRiders = 1` regardless of success

The job tracks `referredRiders` (always 1 at the end) and `rewardsCredited` (incremented only on success). The `referredRiders` count should be `1` only on success. **For a failed reward, `referredRiders = 1` and `rewardsCredited = 0` reads as "we tried 1 rider, credited 0" — but the metric is meant to track successful referrals.**

**Fix:** Set `result.referredRiders = result.rewardsCredited` at the end.

---

### P2-3: `reconciliation.job.ts` returns different shape than the new `wallet-reconciliation.job.ts`

Covered by P0-1.

---

### P2-4: `telemetryCleanupJob` and `auditCleanupJob` use the same idempotency helper but different keys

Both use `checkOrClaimIdempotency(key, 172800)`. The keys are `telemetry-cleanup:daily:YYYY-MM-DD` and `audit-cleanup:daily:YYYY-MM-DD`. **Could share a `dailyJobKey(name: string, date: string)` helper.**

---

### P2-5: `daily-engagement.job.ts` and `telemetryCleanupJob` and `auditCleanupJob` are all cron-driven, not outbox-driven — but they share the idempotency pattern

**3 separate cron jobs that all use the same pattern.** Could be a `runDailyJob(name, fn)` helper.

---

### P2-6: `orphan-event-consumer.job.ts` has a `route()` function that just returns `true`

Covered by P0-5.

---

### P2-7: `reconciliation.job.ts` line 41-44 has `.catch((err: Error) => ...)` that swallows individual backfill errors but doesn't aggregate

If 10K wallets, 100 of them have backfill errors, the job reports success. **The 100 errors are logged but not in the result.** A monitoring system reading the job's return value has no visibility into the per-wallet failures.

**Fix:** Add `result.backfillErrors: number` to the return.

---

### P2-8: `OutboxService.cleanupCompleted(retentionDays = 1)` only runs once per day in the scheduler

**Code:** `workers/index.ts:187-194`

```typescript
{
  name: 'outbox-completed-cleanup',
  intervalMs: 24 * 60 * 60 * 1000, // daily
  processor: async () => {
    const { OutboxService } = await import('./outbox');
    const count = await OutboxService.cleanupCompleted(1);
    // ...
  },
},
```

The cleanup deletes COMPLETED events older than 1 day. **For high-throughput outbox usage, 1 day retention may be too short (forensic analysis) or too long (table bloat).** No config knob.

**Fix:** Read the retention from `SystemSetting` (e.g. `OUTBOX_COMPLETED_RETENTION_DAYS`).

---

## Recommended fix order

| # | Item | Effort | Risk if shipped | Why this order |
|---|---|---|---|---|
| 1 | P0-5 (orphan route + RENT_PAID tag) | 10min | None | Tiny fix; corrects a wrong @deprecated tag |
| 2 | P0-2 (scheduled-backup method) | 5min | Low | The scheduled backup is silently broken; this is the most critical "did we back up" check |
| 3 | P0-3 (notification KYC dup) | 30min | Low | Real bug; KYC in-app row never created |
| 4 | P0-1 (reconciliation wiring) | 1-2h | Medium | Reconciliation is 100x slower than necessary; switching wires the right code |
| 5 | P1-1 (backfill N+1) | included in P0-1 | — | — |
| 6 | P1-2 (device-compliance N+1) | 2-3h | Low | Real perf issue; runs every 60s |
| 7 | P1-7 (RENT_OVERDUE payload) | 30min | Low | Real contract mismatch |
| 8 | P1-6 (REFERRAL_REWARD no-op) | 30min | Low | Real "event acked but not delivered" bug |
| 9 | P0-4 (withJobGuards wiring) | 4-6h | Low | SOC2 DLQ gap; needs schema migration |
| 10 | P1-3 (rent-reminders concurrency) | 2-3h | Low | Per-lease loop blocks faster leases |
| 11 | P1-4 (daily-engagement dob index) | 1-2h | Low | Seq scan for daily query |
| 12 | P1-5 (referral-race pre-check) | 1-2h | Low | Duplicate Transaction risk |
| 13 | P1-8 (orphan multi-subscribe) | 4-6h | Low | 4 polling loops → 1 |
| 14 | P1-10 (reaper 5min→60s) | 1min | None | Faster failover for stuck events |
| 15 | P1-11 (recon idempotency) | 1h | Low | Race window |
| 16 | P1-9 (scheduled-backup outbox) | 1h | Low | Admin UI visibility |
| 17 | P1-12, P1-13, P2-1 to P2-8 (cleanup) | 6-8h | None | Code quality |

**Total: ~3-4 days** for a focused sprint to close all 5 P0s and most P1s.

---

## Tests gap analysis

| Worker | Existing test | Coverage | Gap |
|---|---|---|---|
| `reconciliation.job` | None | — | **No test that it uses the new PR-148 single-query path (P0-1)** |
| `wallet-reconciliation.job` | None | — | No test for the SQL aggregate |
| `notification-dispatch.job` | None | — | **No test for duplicate KYC case behavior (P0-3)** |
| `daily-engagement.job` | None | — | No test for IST date idempotency |
| `rent-reminders.job` | None | — | No test for `periodNo` advance; no test for `hoursUntilDebit` in emitted event (P1-7) |
| `device-compliance.job` | None | — | No test for find-then-create race |
| `referral-reward.job` | None | — | No test for the idempotency race with the use case (P1-5) |
| `orphan-event-consumer.job` | None | — | No test for `route()` (P0-5) |
| `telemetry-cleanup.job` | None | — | No test for PII count audit log |
| `audit-cleanup.job` | None | — | No test for VACUUM behavior |
| `scheduled-backup.job` | None | — | **No test that the actual backup runs (P0-2)** |
| `withJobGuards` | None | — | **No test for any of the DLQ writes (P0-4)** |

**The most critical missing tests:**
1. **PR-148 reconciliation** — assert the old job uses 1 SQL query, not N+1.
2. **Scheduled backup actually runs** — call `checkAndRun()` and assert the backup file exists.
3. **Notification dispatcher KYC** — emit `KYC_APPROVED` and assert a `Notification` row was created (currently fails).
4. **RENT_OVERDUE payload contract** — emit from the job and assert the orphan consumer's `isProactive24h` flag.

---

## Architecture observations

**1. The outbox is well-designed but the implementations are inconsistent.** Each job has its own idempotency mechanism (some use `db.reconciliationReport.findUnique`, some use `checkOrClaimIdempotency`, some have none). The error handling is inconsistent (some `.catch(() => {})`, some throw, some `createAuditLog`). **The `withJobGuards` decorator that would standardize this is dead code.**

**2. Two reconciliation jobs exist; the slow one is wired to the outbox.** The new PR-148 single-query version is wired only to the cron/admin route. The outbox path is what the admin's Background Jobs "Run Now" triggers. **The fast path is unreachable from the standard admin UX.** This is the highest-impact single fix in the audit.

**3. The orphan-event-consumer pattern is a "fan-in" that hides 4 event types behind one processor.** The comment justifies it ("each handler has 1-2 lines of work"). But the `route()` helper that was supposed to be the dispatch is dead code. The actual dispatch is via the `handlers` map. **The code was refactored but the helper wasn't removed.**

**4. The schedulbackup job bypasses the outbox entirely.** The cron runs `checkAndRun()` which calls `runScheduledBackup` directly. The outbox-driven path for the same action would be a `BACKUP_RUN_NOW` event consumed by a `scheduledBackupWorker`. **The cron path is silent to the admin; the outbox path would be visible.** The right design depends on whether backups should be re-queued on failure — if yes, outbox; if no (the schedule is set-and-forget), cron.

**5. The 9 `@deprecated` event types are technical debt with a removal deadline (v0.4).** One of them (`RENT_PAID`) is mis-tagged. The others may or may not be truly unused — `DEPOSIT_APPROVED` is referenced in the dispatcher. **The deprecation list needs an audit before removal.**

**6. The reaper is too slow.** 5 min reaper + 5 min PROCESSING threshold = 10 min max latency for a stuck event. For interactive events (SMS, FCM), this is unacceptable. **Drop both numbers to 30s.**

**7. The job-queue abstraction (`lib/job-queue.ts`) is referenced but not read here.** The `processJobs` method is the foundation of every worker's polling loop. It handles claim semantics, exponential backoff, max-attempts. A deep audit of this would catch a class of issues that this audit only surfaces (e.g. the "interactive priority pre-check" lives in `workers/index.ts` but the actual claim logic is in `JobQueue`).

---

## Out-of-scope notes

- **The `lib/job-queue.ts` internals** (claim semantics, backoff, max-attempts) — not read in detail. The audit surfaces the high-level issues; the JobQueue is a separate audit target.
- **The `OutboxEvent` Prisma model schema** — the index on `(priority, status, createdAt)` added in migration `20260803152322_add_outbox_priority` is referenced. The schema is the foundation; the audit doesn't change it.
- **The `notification-service.ts`** — the dispatcher calls high-level wrappers (`notifyKycStatusChange`, `notifyPaymentReminder`, `notifyRewardMilestone`). These are assumed to do the right thing. A bug in any of them propagates to all notification paths.
- **The `wallet-ledger.service.ts`** — referenced by the rent-reminders and referral-reward jobs. The `credit` / `debit` methods are assumed to enforce the `idempotencyKey` UNIQUE constraint.
- **The `lib/alerter.ts`** — the orphan consumer and the new wallet-reconciliation call `alerter.send(...)`. The alerter is the project's Slack (or log-only) integration. Not audited here.
- **The `lib/audit-log.ts` `deleteExpiredLogs()`** — called by the audit-cleanup job. Not read.
- **The `lib/idempotency.ts` `checkOrClaimIdempotency` / `completeIdempotency` / `failIdempotency`** — used by 3 jobs. The helper is not read in detail; the audit assumes it does what it says.
- **The orphan-event-consumer's `handleAdminAction` is called for `reconciliation.mismatch_alert` events** (per the comment in `reconciliation.job.ts:115`). The handler logs an alerter warning. **If the alerter is configured for Slack, the admin gets a Slack notification on wallet drift.** If not, the alert is log-only.
- **The 30s graceful shutdown timeout** (workers/index.ts:490) — covered in audit #22 P1-10. Same issue.

---

**End of audit. 5 P0s · 13 P1s · 8 P2s.**
