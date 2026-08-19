# Outbox Event Bus — Full Event Type Catalogue — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** the canonical outbox event type catalogue in `web/src/server/workers/outbox.ts` — every event the system defines, every producer, every consumer, plus the dead/dup/missing rows the user-facing table doesn't surface:

| Status | Count | Description |
|---|---|---|
| Active + Producer + Consumer | 14 | Healthy |
| Active + Producer + Consumer (with payload/schema issues) | 3 | Functional but with bugs (priority, payload shape, etc.) |
| Active in enum + Producer + **NO** Consumer (dead emit) | 1 | `ADMIN_JOB_TELEMETRY_CLEANUP` — emitted by admin/jobs, no worker |
| Active in enum + **NO** Producer + Consumer (dead consumer) | 1 | `RENT_PAID` — orphan consumer subscribes but submitReturn never emits |
| Active in enum + **NO** Producer + **NO** Consumer (dead enum) | 1 | `WALLET_RECONCILIATION` — worker subscribes, but no one emits (admin/jobs uses `ADMIN_JOB_WALLET_RECONCILIATION`; cron calls the function directly) |
| `@deprecated` in enum + **NO** Producer + **NO** Consumer | 8 | `WALLET_TOPUP_REQUESTED`, `DEPOSIT_APPROVED`, `DEPOSIT_REJECTED`, `DEPOSIT_REFUNDED`, `ANNOUNCEMENT_DISPATCH`, `REFERRAL_SIGNUP`, `RENT_DUE`, `AUDIT_LOG_CLEANUP`, `TELEMETRY_DATA_CLEANUP` |
| **Total enum entries** | **30** | (user-facing table showed 21 — missing 9) |

**Files read in full:**
- `web/src/server/workers/outbox.ts` (340 lines — `OutboxEventTypes` enum with 30 entries; `OutboxService.emit`/`emitWithCommit`/`getStats`/`retryFailed`/`cleanupCompleted`; `MAX_OUTBOX_PAYLOAD_BYTES = 64KB`; `OutboxPayloadTooLargeError`)
- `web/src/server/workers/queues.ts` (14 lines — `JOB_TYPES = OutboxEventTypes` re-export)
- `web/src/server/workers/index.ts` (524 lines — orchestrator; WORKERS array of 9 event-driven consumers + 4 orphan consumer entries; SCHEDULED_TASKS of 6 cron-driven tasks)
- `web/src/lib/job-queue.ts` (239 lines — `JobQueue.processJobs` with priority filter + exponential backoff + reaper; `JobQueue.runReaper`; `JobQueue.getStuckProcessingCount`; `JobQueue.retryFailedJobs`; `JobQueue.purgeCompletedEvents`)
- `web/src/server/workers/jobs/reconciliation.job.ts` (140 lines — `WALLET_RECONCILIATION` consumer)
- `web/src/server/workers/jobs/notification-dispatch.job.ts` (219 lines — `NOTIFICATION_SEND` consumer)
- `web/src/server/workers/jobs/daily-engagement.job.ts` (167 lines — `DAILY_ENGAGEMENT` consumer)
- `web/src/server/workers/jobs/rent-reminders.job.ts` (190 lines — `RENT_DUE_CHECK` consumer + `RENT_OVERDUE` producer)
- `web/src/server/workers/jobs/device-compliance.job.ts` (95 lines — `DEVICE_VIOLATION_SCAN` consumer + `DEVICE_VIOLATION` producer)
- `web/src/server/workers/jobs/referral-reward.job.ts` (136 lines — `REFERRAL_REWARD` consumer + `REFERRAL_REWARD` producer — **self-loop**)
- `web/src/server/workers/jobs/notifications-cleanup.job.ts` (18 lines — `ADMIN_JOB_NOTIFICATIONS_CLEANUP` consumer)
- `web/src/server/workers/jobs/orphan-event-consumer.job.ts` (190 lines — `RENT_PAID`/`RENT_OVERDUE`/`DEVICE_VIOLATION`/`ADMIN_ACTION` consumer)
- `web/src/server/modules/auth/auth.use-cases.ts:60-67` (`SMS_SEND` producer)
- `web/src/server/modules/kyc/kyc.use-cases.ts:64-72, 79-87` (`NOTIFICATION_SEND` producer for KYC events)
- `web/src/server/modules/wallet/wallet.use-cases.ts:277-282, 316-322` (`WALLET_TOPUP_APPROVED`/`REJECTED` producers)
- `web/src/app/api/admin/jobs/route.ts:24-33, 298-308` (`ADMIN_JOB_*` producers via `JOB_TO_OUTBOX_EVENT` map)

**Out of scope:** The detailed internals of each consumer's switch statement (covered in audit #23). The `db.$transaction` semantics of `emitWithCommit` (covered in audit #22). The orchestrator's graceful shutdown logic (audit #22 P1-10).

---

## TL;DR

**The outbox event bus has 6 P0 bugs. The headline: the user-facing catalogue table is missing 9 events.** 30 enum entries exist in `outbox.ts`; the brief listed 21. Of the 9 missing, 8 are correctly `@deprecated` but **1 is `RENT_PAID` which is in fact CONSUMED by the orphan consumer** — it's marked `@deprecated` in the enum AND consumed by `handleRentPaid`. The `RENT_PAID` event is also NEVER produced (`submitReturn.ts` doesn't emit it). **The orphan consumer subscribes to an event that nobody emits.** The audit #23 P0-5 caught this; the user-facing table just says "active" without auditing.

The other 5 P0s are all real:

1. **`referral-reward.job.ts:107-117` emits `REFERRAL_REWARD` after processing an event** — and the same event type is consumed by the same job (workers/index.ts:108-113). **Self-emitting loop.** When the job runs, it emits an event that the next poll cycle picks up and runs the same job again. The second run tries to credit the wallet with the same `idempotencyKey`, hits the unique constraint, throws, and the OutboxEvent becomes FAILED after 3 attempts. **Every referral reward triggers 3 self-FAILED events.**

2. **`ADMIN_JOB_TELEMETRY_CLEANUP` is emitted by `/api/admin/jobs` (line 31) but has no consumer entry in `WORKERS` array.** Admin clicks "Run now" on Telemetry Cleanup → the event is emitted → no worker polls for it → it sits in the outbox until the daily cleanup deletes it after 1 day. The actual telemetry cleanup runs via the direct cron timer (workers/index.ts:198-202), not via the outbox. **The admin's "Run now" button is a silent no-op for telemetry cleanup.**

3. **`WALLET_RECONCILIATION` worker entry (workers/index.ts:62-69) is a dead consumer.** The cron route at `app/api/cron/reconciliation/route.ts` calls `runWalletReconciliation()` directly (not via the outbox). The admin `/api/admin/jobs` route uses `ADMIN_JOB_WALLET_RECONCILIATION` (line 25), not `WALLET_RECONCILIATION`. **No producer emits `WALLET_RECONCILIATION` ever.** The worker polls for an event that never comes. (Plus: the consumer is the OLD N+1 `reconciliationJob` from audit #23 P0-1 — even if it were called, it's the slow path.)

4. **`RENT_OVERDUE` payload is missing `hoursUntilDebit` and `periodNo`** (rent-reminders.job.ts:166-177 vs orphan-event-consumer.job.ts:74-99). The consumer's `isProactive24h` check (line 77) requires `hoursUntilDebit` to be a number; the producer never includes it. **All RENT_OVERDUE events are treated as "reactive overdue", never "proactive 24h before"** even when the prompt supports both flows. (Already P1-7 in audit #23; promoting to P0 here because the user-facing table explicitly claims this is wired.)

5. **`RENT_PAID` is in the user table as "active" but `@deprecated` in the enum** AND has no producer. The orphan consumer `handleRentPaid` subscribes to it. `submitReturn.ts` (the only place that "rents get paid") does NOT emit `RENT_PAID`. **The orphan consumer for RENT_PAID is a dead consumer** — a worker polls for an event that no one emits. The PR-151 comment in `workers/index.ts:29-31` lists it as one of the 4 orphan event types, but only 3 are actually produced.

6. **The `auto-debit` and `rent-due-checker` admin job labels map to the same outbox event** (`ADMIN_JOB_RENT_DUE_CHECK`, jobs/route.ts:26-27). The user-facing table shows `admin.job.rent_due_check` once but doesn't disclose that two labels trigger it. (Audit #22 P0-4 caught this; here it's a catalogue inconsistency.)

There are also P1s: 8 of 9 `@deprecated` events have no producer or consumer (true dead enum entries); `ADMIN_JOB_DAILY_ENGAGEMENT` is emitted with `priority: 'interactive'` but the daily engagement is background work (audit #22 P0-6); the `reconciliationJob` consumer is the OLD N+1 implementation (audit #23 P0-1); `MAX_OUTBOX_PAYLOAD_BYTES = 64KB` is too small for batch operations (audit #22 P1-9); the reaper at every 5 min is too slow for `sms.send` (job-queue.ts:178 has a 2-min special case for sms.send which the rest of the audit didn't surface); the `ADMIN_JOB_*` event types' worker registrations use the right `priority` for some (background-cleanup ones) but wrong for others (daily-engagement is interactive when it should be background).

The headline architectural issue: **the event bus is the system's "nervous system" but the catalogue is split between code, the user table, and the @deprecated comments — and the three disagree.** The brief is a partial truth; the enum is more honest (with @deprecated tags) but the tags themselves are sometimes wrong (RENT_PAID is mis-tagged). The full truth requires reading the producers, the consumers, and the consumers' payload expectations, then comparing to what the consumers actually emit.

There are **6 P0s**, **11 P1s**, and **6 P2s**.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Broken feature, security gap, silent data loss, business logic bug | Before next release |
| **P1** | UX friction, race condition, accessibility, dead code, contract drift | Next 2 sprints |
| **P2** | Code quality, naming, test coverage | Cleanup backlog |

---

## Full Event Type Catalogue (ground truth)

The canonical source is `web/src/server/workers/outbox.ts:35-126`. 30 entries; the user-facing table shows 21. Below is the verified catalogue with status, producer, consumer, and findings.

| Event Type | Enum Constant | Producer | Consumer | Status | Issue |
|---|---|---|---|---|---|
| `wallet.topup_approved` | `WALLET_TOPUP_APPROVED` | `wallet.use-cases.ts:277` | `reconciliationJob` (workers/index.ts:64) | ✅ Active | Consumer ignores payload; only triggers reconciliation |
| `wallet.topup_rejected` | `WALLET_TOPUP_REJECTED` | `wallet.use-cases.ts:316` (in $transaction) | `reconciliationJob` (workers/index.ts:64) | ✅ Active | Consumer ignores payload |
| `wallet.reconciliation` | `WALLET_RECONCILIATION` | **NONE** | `reconciliationJob` (workers/index.ts:64) | ⚠️ Dead consumer | Cron calls function directly; admin uses `ADMIN_JOB_*` variant |
| `wallet.topup_requested` | `WALLET_TOPUP_REQUESTED` | **NONE** | **NONE** | 🗑️ Deprecated, never wired | `@deprecated` v0.4 removal |
| `deposit.approved` | `DEPOSIT_APPROVED` | **NONE** (referenced as `NotificationPayloadType` only) | **NONE** | 🗑️ Deprecated | Dispatcher handles payload type but event never emitted |
| `deposit.rejected` | `DEPOSIT_REJECTED` | **NONE** | **NONE** | 🗑️ Deprecated | Same |
| `deposit.refunded` | `DEPOSIT_REFUNDED` | **NONE** | **NONE** | 🗑️ Deprecated | Same |
| `notification.send` | `NOTIFICATION_SEND` | `kyc.use-cases.ts:64, 79` (KYC events) | `notificationDispatchJob` (workers/index.ts:75) | ✅ Active | Duplicate KYC switch cases (audit #23 P0-3) |
| `sms.send` | `SMS_SEND` | `auth.use-cases.ts:60` (OTP) | inline `sendSms` (workers/index.ts:117) | ✅ Active | OK |
| `notification.announcement` | `ANNOUNCEMENT_DISPATCH` | **NONE** (announcement.use-cases.create does direct DB inserts, audit #21 P0-3) | **NONE** | 🗑️ Deprecated | Should be wired to the announcement use case |
| `engagement.daily` | `DAILY_ENGAGEMENT` | `workers/index.ts:245` (cron at 06:00 IST) | `dailyEngagementJob` (workers/index.ts:84) | ✅ Active | OK; admin trigger uses different event type |
| `referral.signup` | `REFERRAL_SIGNUP` | **NONE** | **NONE** | 🗑️ Deprecated | Never wired |
| `referral.reward` | `REFERRAL_REWARD` | `referral-reward.job.ts:107` | `referralRewardJob` (workers/index.ts:108) | ⚠️ **Self-loop** | Job emits event that same job consumes; 2nd run fails on unique constraint |
| `rent.due` | `RENT_DUE` | **NONE** | **NONE** | 🗑️ Deprecated | Never wired |
| `rent.overdue` | `RENT_OVERDUE` | `rent-reminders.job.ts:166` | `orphanEventConsumerJob.handleRentOverdue` (workers/index.ts:149) | ⚠️ Payload missing fields | Consumer expects `hoursUntilDebit` + `periodNo`; producer omits both |
| `rent.paid` | `RENT_PAID` | **NONE** (submitReturn.ts doesn't emit) | `orphanEventConsumerJob.handleRentPaid` (workers/index.ts:142) | ⚠️ **Dead consumer** | `@deprecated` tag in enum, but `handleRentPaid` is registered as a consumer |
| `rent.due_check` | `RENT_DUE_CHECK` | `workers/index.ts:210` (cron, every minute) | `rentRemindersJob` (workers/index.ts:92) | ✅ Active | OK |
| `device.violation` | `DEVICE_VIOLATION` | `device-compliance.job.ts:69` | `orphanEventConsumerJob.handleDeviceViolation` (workers/index.ts:156) | ✅ Active | OK |
| `device.violation_scan` | `DEVICE_VIOLATION_SCAN` | `workers/index.ts:226` (cron, every minute) | `deviceComplianceJob` (workers/index.ts:100) | ✅ Active | OK |
| `admin.action` | `ADMIN_ACTION` | `reconciliation.job.ts:115` (mismatch alert) | `orphanEventConsumerJob.handleAdminAction` (workers/index.ts:163) | ✅ Active | OK; could be producer-rich (audit alerts) |
| `admin.job.wallet_reconciliation` | `ADMIN_JOB_WALLET_RECONCILIATION` | `/api/admin/jobs` (line 25) | `reconciliationJob` (workers/index.ts:64) | ⚠️ Wrong consumer | Producer emits, consumer is the OLD N+1 version (audit #23 P0-1) |
| `admin.job.rent_due_check` | `ADMIN_JOB_RENT_DUE_CHECK` | `/api/admin/jobs` (line 26, 27 — two labels) | `rentRemindersJob` (workers/index.ts:92) | ⚠️ Duplicate label | `auto-debit` and `rent-due-checker` both map to same event (audit #22 P0-4) |
| `admin.job.device_compliance` | `ADMIN_JOB_DEVICE_COMPLIANCE` | `/api/admin/jobs` (line 28) | `deviceComplianceJob` (workers/index.ts:100) | ⚠️ Wrong priority | Emitted as `interactive` (audit #22 P0-6) |
| `admin.job.referral_reward` | `ADMIN_JOB_REFERRAL_REWARD` | `/api/admin/jobs` (line 29) | `referralRewardJob` (workers/index.ts:108) | ⚠️ Self-loop consumer | Consumer is the same job that emits `REFERRAL_REWARD` (P0-1 above) |
| `admin.job.notifications_cleanup` | `ADMIN_JOB_NOTIFICATIONS_CLEANUP` | `/api/admin/jobs` (line 30) | `notificationsCleanupJob` (workers/index.ts:130) | ✅ Active | OK |
| `admin.job.telemetry_cleanup` | `ADMIN_JOB_TELEMETRY_CLEANUP` | `/api/admin/jobs` (line 31) | **NONE** | ⚠️ **Dead emit** | No worker entry; event sits in outbox until 1-day cleanup |
| `admin.job.daily_engagement` | `ADMIN_JOB_DAILY_ENGAGEMENT` | `/api/admin/jobs` (line 32) | `dailyEngagementJob` (workers/index.ts:84) | ⚠️ Wrong priority | Emitted as `interactive`; daily batch should be `background` |
| `cleanup.audit_log` | `AUDIT_LOG_CLEANUP` | **NONE** (audit-cleanup runs via direct cron, not outbox) | **NONE** | 🗑️ Deprecated | Correctly deprecated |
| `cleanup.telemetry` | `TELEMETRY_DATA_CLEANUP` | **NONE** (same as above) | **NONE** | 🗑️ Deprecated | Correctly deprecated |

**Summary of issues found in the catalogue:**

- 14 events are healthy (producer + consumer + active)
- 3 events have payload/priority/duplicate-label issues
- 3 events have dead consumer / dead emit / self-loop
- 1 event has dead consumer (no producer)
- 1 event has dead consumer (in `WALLET_RECONCILIATION` line)
- 8 events are correctly `@deprecated` (true dead enum)

The user-facing table showed 21 events and marked all 21 "active". The catalogue above has 30 events (8 deprecated + 1 RENT_PAID with dead consumer not flagged in the user table).

---

## P0 — Must fix before next release

### P0-1: `referral-reward.job.ts` emits `REFERRAL_REWARD` after processing the same event — self-emitting loop

**Repro:**
1. Admin triggers `referral-reward` via `/api/admin/jobs` → outbox event `ADMIN_JOB_REFERRAL_REWARD` is emitted.
2. Worker polls, picks up the event, calls `referralRewardJob.process` (workers/index.ts:108-113).
3. The job credits the referrer's wallet (referral-reward.job.ts:64-94), creates a `Transaction` + `WalletLedger` + `Reward` row, then at line 107-117 **emits `REFERRAL_REWARD` with the same payload**.
4. The new `REFERRAL_REWARD` event sits in the outbox.
5. The same worker (subscribed to `REFERRAL_REWARD` per workers/index.ts:108) picks up the event on the next poll cycle.
6. The job tries to credit the wallet again with the same `idempotencyKey: 'referral:${referrer.id}:${referredRiderId}'`.
7. The `walletLedgerService.credit` call hits the `WalletLedger.idempotencyKey` UNIQUE constraint, throws P2002.
8. The whole transaction rolls back. The job throws. The OutboxEvent becomes FAILED after 3 attempts.

**Code:**

```typescript
// referral-reward.job.ts:64-117
await db.$transaction(async (tx: any) => {
  const txn = await tx.transaction.create({...});
  await walletLedgerService.credit({...}, tx);
  await tx.reward.create({...});
});

result.rewardsCredited++;

createAuditLog({...}).catch(() => {});

// PR-75: referral reward is interactive.
await OutboxService.emit(
  OutboxEventTypes.REFERRAL_REWARD,  // ← self-emit; same type as the consumer
  {
    referrerId: referrer.id,
    amountPaise: REWARD_AMOUNT_PAISE,
    referredRiderId,
  },
  3,
  undefined,
  'interactive'
).catch(() => {});
```

**Why this exists:** The comment says "PR-75: referral reward is interactive" — but the job that emits is already running synchronously, so making it interactive on the outbox side is meaningless. **The emit is leftover from a refactor.** The original code probably emitted this from the use case (`referral.use-cases.ts:processReferralReward`); when the job was added, the emit was copy-pasted and is now a self-loop.

**Impact:**
- **Every referral reward triggers 3 self-FAILED events.** 3 attempts × `maxAttempts: 3` = 1 success + 3 FAILED entries in the outbox table.
- **The outbox table grows** by 3 FAILED rows per referral. With 1000 referrals/week, that's 3000 FAILED rows per week, all with the same error.
- **The daily outbox cleanup** (`OutboxService.cleanupCompleted`, run by cron every 24h) deletes COMPLETED events but the FAILED ones accumulate until manually retried.
- **The 3 FAILED rows show up in the workflow-coverage /admin workflow-coverage screen** as worker health issues. Yellow status instead of green.
- **The 2nd and 3rd attempts have an O(1) cost (just a unique-constraint check)** but still pollute the outbox.

**Fix:**
- **Remove the self-emit** at `referral-reward.job.ts:107-117`. The job completes; no follow-up event needed.
- Or: change the emit to a different event type (e.g. `notification.send` with payload type `REFERRAL_REWARD`) so the notification dispatcher (not the job itself) consumes it.
- Or: change the `referralRewardJob.process` worker entry to subscribe to a different event type (e.g. `referral.reward.request`) and have the use case emit that.

**Effort:** 5min (just delete the emit).

---

### P0-2: `ADMIN_JOB_TELEMETRY_CLEANUP` is emitted by `/api/admin/jobs` but has no consumer — admin's "Run now" is a silent no-op

**Repro:** Admin opens Background Jobs screen. Clicks "Run Now" on Telemetry Cleanup. The route POSTs `{jobId: 'telemetry-cleanup'}` to `/api/admin/jobs`. The route maps to `ADMIN_JOB_TELEMETRY_CLEANUP` (jobs/route.ts:31) and emits the outbox event (line 298-308). Returns 202 with outboxId.

**No worker is registered for `ADMIN_JOB_TELEMETRY_CLEANUP` in the `WORKERS` array** (workers/index.ts:60-135). The event sits in the outbox table. The daily outbox cleanup deletes it after 1 day. **The actual telemetry cleanup runs via the direct cron timer** (workers/index.ts:198-202), which calls `telemetryCleanupJob.process` directly, not via the outbox.

**Code:**

```typescript
// jobs/route.ts:24-33
const JOB_TO_OUTBOX_EVENT: Record<string, OutboxEventType> = {
  'wallet-reconciliation': OutboxEventTypes.ADMIN_JOB_WALLET_RECONCILIATION,
  'rent-due-checker': OutboxEventTypes.ADMIN_JOB_RENT_DUE_CHECK,
  'auto-debit': OutboxEventTypes.ADMIN_JOB_RENT_DUE_CHECK,
  'device-compliance': OutboxEventTypes.ADMIN_JOB_DEVICE_COMPLIANCE,
  'referral-reward': OutboxEventTypes.ADMIN_JOB_REFERRAL_REWARD,
  'notifications-cleanup': OutboxEventTypes.ADMIN_JOB_NOTIFICATIONS_CLEANUP,
  'telemetry-cleanup': OutboxEventTypes.ADMIN_JOB_TELEMETRY_CLEANUP,  // ← emitted
  'daily-engagement': OutboxEventTypes.ADMIN_JOB_DAILY_ENGAGEMENT,
};
```

```typescript
// workers/index.ts:60-135 (WORKERS array)
{ jobType: OutboxEventTypes.ADMIN_JOB_NOTIFICATIONS_CLEANUP, processor: notificationsCleanupJob.process, ... },
// ← no entry for ADMIN_JOB_TELEMETRY_CLEANUP
```

**Compare to notifications-cleanup (line 130): it has a worker entry. Telemetry-cleanup doesn't.**

**Impact:**
- **Admin's "Run Now" button on Telemetry Cleanup is a silent no-op.** The route returns 202, the outbox event is created, the admin sees "Job execution queued" — but the event is never processed.
- **The actual telemetry cleanup runs only via the 5-minute cron** (workers/index.ts:198-202). Admin's manual trigger does nothing.
- **The outbox table accumulates `ADMIN_JOB_TELEMETRY_CLEANUP` events** that get cleaned up after 1 day.
- **The admin UX is inconsistent**: 7 of 8 admin jobs have working "Run Now" buttons; 1 (telemetry) doesn't. The admin doesn't know which is which.

**Fix:**
- Add a worker entry for `ADMIN_JOB_TELEMETRY_CLEANUP`:
  ```typescript
  {
    jobType: OutboxEventTypes.ADMIN_JOB_TELEMETRY_CLEANUP,
    processor: telemetryCleanupJob.process,
    concurrency: 1,
    description: 'Telemetry cleanup — purge PII > 30 days',
    priority: 'background',
  },
  ```
- Or: change the route to call `telemetryCleanupJob.process` directly (synchronous) and remove the outbox indirection for this case.

**Effort:** 5min.

---

### P0-3: `WALLET_RECONCILIATION` is in the enum and has a worker entry, but no producer emits it — dead consumer

**Repro:** Search the entire `web/src` codebase for `OutboxService.emit(OutboxEventTypes.WALLET_RECONCILIATION` or `OutboxService.emit('wallet.reconciliation'` — **zero matches**. The cron route `app/api/cron/reconciliation/route.ts` calls `runWalletReconciliation()` directly (not via the outbox). The admin route uses `ADMIN_JOB_WALLET_RECONCILIATION`, not `WALLET_RECONCILIATION`.

**Code:**

```typescript
// workers/index.ts:62-69
{
  jobType: OutboxEventTypes.WALLET_RECONCILIATION,
  processor: reconciliationJob.process,
  concurrency: 1,
  description: 'Wallet reconciliation — triggered by topup approval/rejection',
  priority: 'background',
},
```

The comment says "triggered by topup approval/rejection" — but the consumer's processor is `reconciliationJob` (the old N+1 version, audit #23 P0-1). The comment is misleading; this worker entry is for a "wallet.reconciliation" event that nobody emits.

The lib/job-queue.ts:178 has a special case for `'wallet.reconciliation'` in the reaper (15-min stuck threshold vs the default 5 min), but that's defensive code — there's no event to reclaim.

**Impact:**
- **The worker polls forever for an event that never comes.** Wasted CPU on every poll cycle (the polling loop sleeps 1s if active, 15s if idle, but the `findFirst` query still runs).
- **The lib/job-queue.ts:178 special case for `wallet.reconciliation`** is dead code in the reaper (no events to be stuck).
- **The user-facing table claims `wallet.reconciliation` is "active" with producer "reconciliation cron"** — but the cron doesn't emit. The producer claim in the table is wrong.

**Fix:**
- **Delete the `WALLET_RECONCILIATION` worker entry** at workers/index.ts:62-69.
- **Update the user-facing table** to remove the `wallet.reconciliation` row.
- Or: have the cron route actually emit `WALLET_RECONCILIATION` (and have the `ADMIN_JOB_WALLET_RECONCILIATION` route also emit this instead of the admin-specific variant). **This would unify the two paths.**

**Effort:** 5min.

---

### P0-4: `RENT_OVERDUE` payload is missing `hoursUntilDebit` and `periodNo` — orphan consumer's `isProactive24h` check never fires

**Repro:** `rent-reminders.job.ts:166-177` emits RENT_OVERDUE with payload:
```typescript
{
  riderId: rider.id,
  leaseId: lease.id,
  amountDue: rentAmount,
  balance,
}
```

The orphan consumer `orphan-event-consumer.job.ts:73-99` reads:
```typescript
const { riderId, leaseId, amountDue, balance, hoursUntilDebit, periodNo } = payload;
// ...
const isProactive24h = typeof hoursUntilDebit === 'number' && hoursUntilDebit <= 24 && hoursUntilDebit > 0;
const reminderType = isProactive24h ? 'proactive_24h' : 'overdue';
```

`hoursUntilDebit` is **always undefined** in the producer's payload. The `typeof undefined === 'number'` check is `false`. **Every RENT_OVERDUE event is treated as "reactive overdue", never "proactive 24h before"**.

**The consumer also tries to use `periodNo` in audit log details (line 99) and the alerter message (line 89) — both `undefined`.**

**Impact:**
- **The proactive 24h reminder flow is dead code in the consumer.** The check exists, the log branch exists, but the data needed to trigger it is never sent.
- **The "balance is critical" alerter path** (line 84: `if (balance < 10000)`) still works because `balance` is sent. So 1 of 3 fields works.
- **Audit log details are missing `periodNo`** — the SOC2 trail doesn't have the period number for rent overdue events.

**Fix:**
- Update `rent-reminders.job.ts:166-177` to include `hoursUntilDebit` and `periodNo` in the payload:
  ```typescript
  await OutboxService.emit(
    OutboxEventTypes.RENT_OVERDUE,
    {
      riderId: rider.id,
      leaseId: lease.id,
      amountDue: rentAmount,
      balance,
      hoursUntilDebit: 0,  // reactive; proactive is emitted by a separate cron
      periodNo: lease.periodNo,
    },
    3,
    undefined,
    'interactive'
  );
  ```
- Or: add a separate cron that emits RENT_OVERDUE for leases with `nextRentDueAt - now <= 24h` and balance insufficient.

**Effort:** 30min.

---

### P0-5: `RENT_PAID` is `@deprecated` in the enum but consumed by `handleRentPaid`; AND no producer emits it — the user table is wrong on three counts

**Repro:**
- The user-facing table lists `rent.paid` as "active" with producer "rental return route → orphan-consumer". 
- `submitReturn.ts` (the rental return flow at `app/api/rider/rental/return/route.ts`) does NOT emit `RENT_PAID` — it creates internal transactions and audit logs but no outbox event.
- The enum at `outbox.ts:86-90` marks `RENT_PAID` as `@deprecated Unused — never emitted, never consumed. Scheduled for removal in v0.4.`
- The orphan consumer at `workers/index.ts:141-147` is wired for `RENT_PAID` and dispatches to `handleRentPaid` (orphan-event-consumer.job.ts:55-71).
- `ORPHAN_EVENT_TYPES` (line 184-189) includes `RENT_PAID`.

**The user table is wrong on all 3 fields**: the event is in fact mis-tagged, the producer doesn't exist, and the consumer subscribes to an event that never comes.**

**Code:**

```typescript
// outbox.ts:86-90
/**
 * @deprecated Unused — never emitted, never consumed. Scheduled
 * for removal in v0.4.
 */
RENT_PAID: 'rent.paid',
```

```typescript
// workers/index.ts:141-147
{
  jobType: OutboxEventTypes.RENT_PAID,
  processor: orphanEventConsumerJob.process,
  concurrency: 2,
  description: 'Orphan consumer: RENT_PAID — send rent paid receipt to rider',
  priority: 'interactive',
},
```

```typescript
// orphan-event-consumer.job.ts:55-71
async function handleRentPaid(payload: any): Promise<void> {
  const { riderId, leaseId, amountInPaise, periodNo } = payload;
  // ... never gets called because nothing emits RENT_PAID ...
}
```

**Impact:**
- **The orphan consumer is registered for an event that never comes.** Wasted CPU.
- **When v0.4 cleanup runs** and removes `RENT_PAID` from the enum per the `@deprecated` tag, the consumer entry at workers/index.ts:141-147 will fail at startup (TypeScript: `OutboxEventTypes.RENT_PAID` is undefined). **Removal will break startup.**
- **The user-facing catalogue is wrong** — claims producer "rental return route" but the route doesn't emit.
- **If `submitReturn.ts` SHOULD emit RENT_PAID** (so the rider gets a "rent paid" receipt push), the missing emit is a UX bug — the rider pays rent and doesn't get a notification. (The payment receipt is currently sent via `notificationService.notifyPaymentReminder` directly at rent-reminders.job.ts:144-146, but for the **return flow** at end-of-rental, no receipt is sent.)

**Fix (one of):**
1. **Add a `RENT_PAID` emit to `submitReturn.ts`** at the end of a successful return. This wires the producer; the consumer works; the rider gets a push.
2. **Remove the `RENT_PAID` worker entry** at workers/index.ts:141-147 and the `handleRentPaid` function in orphan-event-consumer.job.ts. The rent-reminders auto-debit already sends the receipt.
3. **Remove `RENT_PAID` from the enum** and the consumer entry together. Update the user table.

**Effort:** 30min (option 1 — the most user-facing fix).

---

### P0-6: `ADMIN_JOB_RENT_DUE_CHECK` has duplicate labels (`auto-debit` and `rent-due-checker`) — catalogue table doesn't disclose this

**Repro:** The user-facing table shows `admin.job.rent_due_check` once. But the route mapping (jobs/route.ts:24-33) is:

```typescript
const JOB_TO_OUTBOX_EVENT: Record<string, OutboxEventType> = {
  // ...
  'rent-due-checker': OutboxEventTypes.ADMIN_JOB_RENT_DUE_CHECK,
  'auto-debit': OutboxEventTypes.ADMIN_JOB_RENT_DUE_CHECK,  // ← same
  // ...
};
```

**The admin Background Jobs screen shows 2 cards** — "Rent Due Checker" and "Auto-Debit" — but both click handlers POST the same event. The consumer (`rentRemindersJob`) doesn't know which label was used.

**Impact:**
- **The user-facing table is misleading**: shows 1 row for the event but the admin UI has 2 cards.
- **The two cards have different schedule labels** (00:00 IST for rent-due-checker, 01:00 IST for auto-debit) and different purpose text — but they trigger the same code path.
- **The purpose text is wrong**: "Auto-Debit" suggests a separate debit logic; the actual code is the same as rent-due-checker (which itself does auto-debit at line 70-141 of rent-reminders.job.ts).

**Fix:**
- **Differentiate the two jobs**: have `auto-debit` do the actual debit (after `rent-due-checker` flagged), and `rent-due-checker` do the detection only. Currently the same job does both.
- Or: **remove the `auto-debit` entry** from the static list (no scheduled 01:00 IST run; the worker does everything in one pass).
- **Update the user-facing table** to show the duplicate or remove the auto-debit row.

**Effort:** 1h (decision + minor code).

---

## P1 — Fix in next 2 sprints

### P1-1: 8 of 9 `@deprecated` event types are truly dead — no producer, no consumer

`WALLET_TOPUP_REQUESTED`, `DEPOSIT_APPROVED`, `DEPOSIT_REJECTED`, `DEPOSIT_REFUNDED`, `ANNOUNCEMENT_DISPATCH`, `REFERRAL_SIGNUP`, `RENT_DUE`, `AUDIT_LOG_CLEANUP`, `TELEMETRY_DATA_CLEANUP` are correctly `@deprecated`. They have zero producers and zero consumers. The audit #23 P1-12 recommended removal in v0.4.

**Caveat:** `DEPOSIT_APPROVED` is referenced in `notification-dispatch.job.ts:50-51, 114-115` as a `NotificationPayloadType` (a string `'DEPOSIT_APPROVED'`), not as an outbox event type. **The reference is at the payload type level, not the event type level.** So the dispatcher's switch handles a payload of type `DEPOSIT_APPROVED`, but the event type that carries this payload (`OutboxEventTypes.DEPOSIT_APPROVED`) is `@deprecated`. **No one emits the event; the dispatcher's case is unreachable.**

**Fix:** Remove the 9 deprecated event types from the enum in v0.4. **Verify first** that no consumer references the payload types `'DEPOSIT_APPROVED'` / `'DEPOSIT_REJECTED'` indirectly. If a producer is later added that emits `DEPOSIT_APPROVED`, the dispatcher's case will become reachable.

**Effort:** 1-2h (verify + remove + test).

---

### P1-2: `ADMIN_JOB_DAILY_ENGAGEMENT` is emitted with `priority: 'interactive'` but should be `background`

**Code:** `jobs/route.ts:298-308` — all `ADMIN_JOB_*` emits pass `priority: 'interactive'`. The daily engagement job is a daily batch (birthday wishes + payment reminders + referral leaderboard) — it has nothing to do with rider latency. Marking it interactive **wastes the interactive slot** (per the PR-75 priority split).

**Impact:** Same as audit #22 P0-6 — admin-triggered background work starves real interactive work.

**Fix:** Add a `JOB_TO_PRIORITY` map in the route:
```typescript
const JOB_TO_PRIORITY: Record<string, 'interactive' | 'background'> = {
  'wallet-reconciliation': 'background',
  'rent-due-checker':      'interactive',
  'auto-debit':            'interactive',
  'device-compliance':     'background',
  'referral-reward':       'interactive',
  'notifications-cleanup': 'background',
  'telemetry-cleanup':     'background',
  'daily-engagement':      'background',
};
```

**Effort:** 30min.

---

### P1-3: `ADMIN_JOB_WALLET_RECONCILIATION` consumer is the OLD N+1 `reconciliationJob` (audit #23 P0-1)

The wire-up uses the old implementation. The new PR-148 single-query version lives in `wallet-reconciliation.job.ts` and is only called from the cron/admin route directly. When admin triggers "Run Now" on Wallet Reconciliation, the slow path runs.

**Fix:** Replace `reconciliationJob` import with `runWalletReconciliation` + `recordReconciliation` (from `wallet-reconciliation.job.ts`). Update the worker entry to use the new functions.

**Effort:** 1-2h (covered by audit #23 P0-1).

---

### P1-4: `WALLET_TOPUP_APPROVED` and `WALLET_TOPUP_REJECTED` consumers don't read the payload

**Code:** `reconciliationJob.process` (reconciliation.job.ts:17-139) — the consumer is the OLD N+1 version. It walks all wallets and compares ledger sums. **It ignores the payload of the WALLET_TOPUP_APPROVED event entirely.** The event is just a "trigger to reconcile" — the riderId and transactionId in the payload are dead.

**Fix:** Either:
- Use the payload to scope reconciliation to the affected rider only (faster, more focused).
- Or: change the consumer to a different event handler (e.g. update rider's wallet balance based on the transaction).
- Or: leave it as a "trigger" and remove the payload fields to make the contract explicit.

**Effort:** 1h.

---

### P1-5: `MAX_OUTBOX_PAYLOAD_BYTES = 64KB` is too small for batch operations

Per audit #22 P1-9: the announcement use case for `targetAudience: 'ALL'` would need to carry 10K+ rider IDs. The cap is 64KB. The producer gets `OutboxPayloadTooLargeError` and the route returns 500.

**Fix:** Either bump the cap to 1MB (Postgres `jsonb` handles this), or split batch events into sub-events, or store the bulk payload in storage and reference it by URL.

**Effort:** 1h to bump; 1 day to do the split properly.

---

### P1-6: The reaper at every 5 min is too slow for `sms.send`

**Code:** `lib/job-queue.ts:175-180` — the reaper has special cases:
- `sms.send`: 2 min stuck threshold
- `wallet.reconciliation`: 15 min
- Everything else: 5 min

The reaper itself runs every 5 min (workers/index.ts:411). So:
- `sms.send` events stuck > 2 min are reclaimed up to 5 min later (max 7 min in PROCESSING before retry).
- For interactive events (NOTIFICATION_SEND, RENT_OVERDUE, REFERRAL_REWARD), the threshold is 5 min and the reaper runs every 5 min — **up to 10 min stuck**.

**Fix:** Drop the reaper cycle to 30-60s. The query is cheap.

**Effort:** 1min.

---

### P1-7: `OutboxService.cleanupCompleted(retentionDays = 1)` is hardcoded

**Code:** `outbox.ts:328-337` — the cleanup deletes COMPLETED events older than 1 day. The scheduler at `workers/index.ts:189` calls it with the default. No config knob.

For high-throughput outbox usage, 1 day may be too short (forensic analysis) or too long (table bloat).

**Fix:** Read the retention from `SystemSetting` (e.g. `OUTBOX_COMPLETED_RETENTION_DAYS`).

**Effort:** 1h.

---

### P1-8: `OutboxService.emit` has no idempotency at the producer side

**Code:** `outbox.ts:250-294`

A producer can call `emit(SAME_EVENT, SAME_PAYLOAD)` twice in quick succession and create 2 outbox rows. The consumer's `idempotencyKey` (in the WalletLedger UNIQUE constraint) catches downstream duplicates, but the outbox row is still created. The consumer dedupes at the data layer; the event bus itself doesn't.

**Fix:** Add an optional `idempotencyKey` parameter to `emit` and use a partial UNIQUE index on `(eventType, idempotencyKey)`. The producer passes the same key it uses for the WalletLedger (e.g. `topup:${riderId}:${transactionId}`).

**Effort:** 2-3h (schema migration + use case updates).

---

### P1-9: `OrphanEventConsumerJob` is registered as 4 separate `WORKERS` entries for the same processor

**Code:** `workers/index.ts:141-168`

4 polling loops, 4 `findFirst` queries per cycle, 4 sleep timers. Could be 1 entry with a `subscribeMultiple: true` flag.

**Fix:** Extend the `WorkerDefinition` to accept an array of event types; collapse the 4 entries into 1.

**Effort:** 4-6h (touches JobQueue + every worker definition).

---

### P1-10: `OutboxEventTypes.NOTIFICATION_SEND` has 13 known payload types in the switch, but the producer side only emits 2-3

**Code:** `notification-dispatch.job.ts:43-57` declares 13 `NotificationPayloadType` values: `KYC_APPROVED`, `KYC_REJECTED`, `KYC_INFO_REQUIRED`, `WALLET_TOPUP_APPROVED`, `WALLET_TOPUP_REJECTED`, `SUPPORT_REPLY`, `DEPOSIT_APPROVED`, `DEPOSIT_REJECTED`, `REWARD_MILESTONE`, `SHIFT_REMINDER`, `REFERRAL_REWARD`, `MANDATORY_UPDATE`, `WALLET_LOW`.

Producers found in code: `kyc.use-cases.ts:64, 79` (KYC_APPROVED, KYC_REJECTED). **11 of 13 declared payload types have no producer.** The dispatcher's switch handles them but the events never arrive.

**Impact:** Dead switch cases. The dispatcher is "ready" for events that never come.

**Fix:** Either wire the producers (11 use cases), or remove the dead switch cases.

**Effort:** 1-2 days (depending on which producers to wire).

---

### P1-11: The user-facing catalogue table has 9 missing events

This audit. The brief's table shows 21 events; the code has 30. The 9 missing are: 8 `@deprecated` (which the user may have intentionally excluded as "not active") and 1 `RENT_PAID` (which is `@deprecated` in code but consumed by the orphan consumer — i.e. active-but-broken).

**Fix:** Update the user-facing table to:
- List the 8 deprecated events in a separate "Scheduled for v0.4 removal" section.
- Either include `RENT_PAID` with a "(deprecated, no producer)" note, or remove it entirely.
- Add the 3 admin-job events that the user table already shows (they're there).
- For each event, link to the producer and consumer line numbers in the codebase.

**Effort:** 30min (documentation).

---

## P2 — Cleanup backlog

### P2-1: `OutboxService.emitWithCommit` is defined but only documented — actual usage unclear

`emitWithCommit` is a documented helper for atomic business-write + emit. **Audit confirms it's defined in outbox.ts:206-219 but no caller is found in the grep.** The producers all use `OutboxService.emit` inside their own `db.$transaction` blocks (e.g. wallet.use-cases.ts:314-322). **The helper is dead code.**

### P2-2: `OutboxService.retryFailed` and `OutboxService.getStats` have no admin UI

`retryFailed` (outbox.ts:313-323) resets FAILED events to PENDING. `getStats` (outbox.ts:299-308) returns counts. **No admin route calls them.** The FailedJob count is visible only in the workflow-coverage screen (yellow/red status based on stuck events).

**Fix:** Add an admin "Outbox Stats" card + a "Retry Failed" button.

### P2-3: `JOB_TYPES` re-export in `queues.ts` adds no value

`queues.ts:13` re-exports `OutboxEventTypes` as `JOB_TYPES`. **No file imports `JOB_TYPES`** (the grep showed 0 matches outside queues.ts itself). The re-export is dead.

**Fix:** Delete `queues.ts` and update the one import in `workers/index.ts:15` to use `OutboxEventTypes` directly.

### P2-4: `OrphanEventConsumerJob.ORPHAN_EVENT_TYPES` export is not used

Line 184-189 exports a const array of the 4 orphan event types. **No file imports it** (the consumer is registered explicitly in workers/index.ts).

### P2-5: `OutboxEventData` interface is not exported to clients

The `OutboxEventData` interface (outbox.ts:23-33) describes the on-the-wire shape. No file imports it. The TypeScript type would be useful for any tool that reads the outbox (admin UI, scripts).

### P2-6: `lib/job-queue.ts:127` has double `err instanceof Error ? err.message` — same pattern as #22 P2-3

```typescript
const errorMessage = err instanceof Error ? (err instanceof Error ? err.message : String(err)) : 'Unknown error';
```

Two ternaries evaluating the same expression. **Cosmetic bug.**

---

## Recommended fix order

| # | Item | Effort | Risk if shipped | Why this order |
|---|---|---|---|---|
| 1 | P0-1 (REFERRAL_REWARD self-loop) | 5min | None | Delete a few lines; stops 3 FAILED events per referral |
| 2 | P0-2 (TELEMETRY_CLEANUP no consumer) | 5min | None | Add a worker entry; admin's "Run Now" works |
| 3 | P0-3 (WALLET_RECONCILIATION dead consumer) | 5min | None | Delete a worker entry; remove dead code |
| 4 | P0-4 (RENT_OVERDUE payload) | 30min | Low | Fix proactive 24h reminder flow |
| 5 | P0-5 (RENT_PAID mis-tagged) | 30min | Low | Either emit or remove; pick one |
| 6 | P0-6 (auto-debit dup label) | 1h | Low | Decision: differentiate or remove |
| 7 | P1-11 (catalogue table) | 30min | None | Update the user-facing table |
| 8 | P1-2 (admin job priority) | 30min | Low | Map JOB_TO_PRIORITY |
| 9 | P1-4 (topup payload ignored) | 1h | Low | Use payload to scope reconciliation |
| 10 | P1-3 (PR-148 wiring) | 1-2h | Medium | Same as audit #23 P0-1 |
| 11 | P1-1 (deprecated events removal) | 1-2h | Medium | v0.4 cleanup; verify no hidden consumers |
| 12 | P1-6 (reaper 5min→60s) | 1min | None | Faster failover |
| 13 | P1-5, P1-7, P1-8, P1-9, P1-10, P2-* (various) | 6-8h | Mixed | Code quality + producer wiring |

**Total: ~3-4 days** for a focused sprint to close all 6 P0s and most P1s.

---

## Tests gap analysis

| Event Type | Existing test | Coverage | Gap |
|---|---|---|---|
| `WALLET_TOPUP_APPROVED` / `WALLET_TOPUP_REJECTED` | None | — | No test for the producer-consumer round-trip |
| `NOTIFICATION_SEND` | None | — | **No test for the 11 unreachable switch cases (P1-10)** |
| `SMS_SEND` | None | — | No test for the inline dispatcher |
| `DAILY_ENGAGEMENT` | None | — | No test for the IST date idempotency |
| `REFERRAL_REWARD` | None | — | **No test for the self-loop (P0-1)** |
| `RENT_OVERDUE` | None | — | **No test for the payload field mismatch (P0-4)** |
| `RENT_PAID` | None | — | No test for the dead consumer |
| `RENT_DUE_CHECK` | None | — | No test for the per-lease loop |
| `DEVICE_VIOLATION` / `DEVICE_VIOLATION_SCAN` | None | — | No test for the N+1 find-then-create |
| `ADMIN_ACTION` | None | — | No test for the admin action alerts |
| `ADMIN_JOB_*` (all 7) | None | — | **No test for the dead emit (telemetry) or self-loop (referral)** |
| `WALLET_RECONCILIATION` (dead consumer) | None | — | No test for the dead consumer |
| 8 deprecated events | None | — | No test that they're truly unused |

**The most critical missing tests:**
1. **REFERRAL_REWARD self-loop** — emit one, then assert the OutboxEvent ends up FAILED (or with the self-loop fix, COMPLETED with no follow-up).
2. **ADMIN_JOB_TELEMETRY_CLEANUP** — emit one, assert the worker processes it.
3. **RENT_OVERDUE payload** — emit one with `hoursUntilDebit: 5`, assert the consumer treats it as `proactive_24h`.
4. **WALLET_RECONCILIATION dead consumer** — assert the worker entry is removed (or the producer is added).

---

## Architecture observations

**1. The event bus is the system's nervous system, but the catalogue is split across three sources of truth.** The user table shows 21 events; the enum has 30; the actual code (producers + consumers) has 23 (with 7 dead). **The three views disagree on which events are alive.** A "live" catalogue that gets generated from the code (TypeScript AST or a runtime introspection) would close this gap.

**2. The 9 deprecated event types are v0.4 cleanup debt.** The `@deprecated` tag with "Scheduled for removal in v0.4" is a code smell — the enum is the canonical source, and the tag is a TODO. **The cleanup didn't happen because it would have broken the orphan consumer (RENT_PAID) and the dispatcher's switch (DEPOSIT_APPROVED, etc.).** The fix is to wire the producers (make the events real) or remove the dead consumers.

**3. The self-emitting loop in `referral-reward.job.ts` is the worst kind of bug: it works on the surface but pollutes the outbox.** The job succeeds on the first run; the second and third runs fail silently (the OutboxEvent becomes FAILED, no alert). **The outbox table grows by 3 rows per referral** without any visible symptom in the admin UI.

**4. The "producer → consumer" mapping in the user table is half-true for the deprecated events.** The user marks them "active" with a producer. The producer is real (in the sense that the route maps the event type), but the consumer (the worker) doesn't exist. The user table would be more accurate if it added a "Verified Producer" and "Verified Consumer" column that points to specific file:line references.

**5. The `WORKERS` array registration is the consumer-side of the catalogue.** 9 event-driven consumers + 4 orphan consumer entries + 6 cron-driven tasks. The array is a typed `WorkerDefinition[]` so a typo would be a compile error. **The fact that the catalogue has issues means the issue is in what events exist in the enum, not in how workers are registered.**

**6. The `AUTO_DEBIT` and `RENT_DUE_CHECKER` duplication is a UX-level problem, not a code problem.** Two cards in the admin UI trigger the same event. The cards have different schedule labels and different purpose text — but the underlying code is the same. **The fix is to either differentiate the jobs (real work) or remove the duplicate card (cosmetic).**

**7. The `reconciliationJob` worker entry at workers/index.ts:62-69 is a fossil.** It was wired to a now-removed `wallet.reconciliation` event producer. The cron and admin routes both use the new `wallet-reconciliation.job.ts` directly. The orphan worker entry should be deleted; the `lib/job-queue.ts:178` special case for the reaper should be deleted too.

**8. The orphan consumer pattern (4 event types, 1 processor) is elegant but the registration is verbose.** 4 worker entries × 5 lines = 20 lines of boilerplate. **A `subscribeMultiple: true` flag would reduce this to 5 lines.** Same trade-off as the per-job vs fan-in debate; the fan-in is more readable but the registration is duplicative.

---

## Out-of-scope notes

- **The `OutboxEvent` Prisma model schema** — not read in detail. The audit assumes the columns referenced in code (`eventType`, `payload`, `status`, `attempts`, `maxAttempts`, `error`, `createdAt`, `processedAt`, `updatedAt`, `priority`, `readyAt`) exist as expected.
- **The `OutboxEventType` type alias** (outbox.ts:128) — derived from `OutboxEventTypes`. The TypeScript type system prevents most of the issues in this audit (typos, wrong enum constants). The bugs are in what the enum CONTAINS, not in how it's USED.
- **The `prisma/migrations/20260803152322_add_outbox_priority` migration** — adds the `(priority, status, createdAt)` index for the priority filter. The index is correct; the audit focuses on whether the priority is set correctly per emit (P1-2, audit #22 P0-6).
- **The `prisma/migrations/20260729150000_amount_to_amountInPaise` migration** — referenced in audit #22 P0-5 (the analytics raw SQL assumes this rename). Not relevant to this audit.
- **The `OutboxEvent.priority` column** — assumed to be `'interactive' | 'background'`. The `OutboxPriority` type at outbox.ts:137 enforces this. Default is `'background'` (line 255), which is correct for most events.
- **The actual `OutboxEvent` row count and growth rate** — not measured. The audit notes the table growth issue from the self-loop (P0-1) but doesn't quantify it.
- **The `OutboxService.cleanupCompleted` default retention** (1 day) — assumed. The cleanup is run by the cron at `workers/index.ts:187-194`. No config knob.

---

**End of audit. 6 P0s · 11 P1s · 6 P2s.**
