# Workflows Deep Audit — Worker Orchestration, Queue/Outbox/Idempotency, CI

**Date:** 2026-08-23
**Scope:** Web background workers + outbox/job-queue/idempotency libs + cron/internal entry points + 13 GitHub Actions workflows.
**Surface:** 16 job workers · 5 cron/internal entry points · 13 GitHub Actions workflows (~4,100 lines) · outbox.ts · job-queue.ts · idempotency.ts · cron-auth.ts.

**Source:** This document is a re-audit of the worker subsystem. The 2026-07-29 worker audit (`docs/AUDIT_WORKERS.md`, 66 KB, 10-PR plan) is still the canonical baseline — this document supersedes only the items called out as "fixed in this re-audit" (stale-claim stealing, reaper attempts-increment, 4xx→FAILED, DATABASE_URL scope to job, pr-smoke-load continue-on-error removal). All other findings are reproduced from the user's fresh deep audit, with line references re-verified against the current `main` on 2026-08-23.

**Scorecard (this re-audit):**
- 🔴 **CRITICAL P0:** 1 file with 2 P0 findings (rent-reminders + notification-dispatch)
- 🟠 **NEEDS WORK P1:** 14 findings across 8 files
- 🟡 **MINOR P2:** 12 findings
- 🟢 **PASS / exemplary:** 8 areas (job-claim atomicity, cron-auth fail-closed, integer-paise math, backoff math, reconciliation-only auto-heal removal, in-tx outbox emit, audit atomicity, no prod hosts hit by load tests, zero pwn-request surface, keystore lifecycle)

## 0. Executive summary

The two critical P0s are in the highest-traffic money/notification paths:

1. **Rent-reminders** has a 100× currency bug (`paise` rendered as if `rupees` via `₹${amount.toFixed(2)}`), no fire-once gate on the emitter (fires 60×/hour during the 6/18 IST windows), no per-lease-per-period sent-marker on the overdue path, and a double-receipt (direct `notificationService` call inside the job + the orphan-event consumer firing the same notification off the `RENT_PAID` outbox row that the job also emits). The auto-debit path itself is exemplary: periodNo CAS + unique idempotency key + in-tx outbox emit. **P0 = `rent-reminders.job.ts:196-227` (overdue path) + `index.ts:379-410` (emitter) + `notification-service.ts:93` (format string).**
2. **KYC INFO_REQUESTED** is emitted by `kyc.use-cases.ts:130-134` with `type: 'KYC_INFO_REQUESTED'`, but the dispatcher (`notification-dispatch.job.ts:43-56, 90-244`) only handles `KYC_INFO_REQUIRED`. The event falls into the `default:` case → logged "Unknown payload type — acking" → marked COMPLETED, never retried. Riders are never told their KYC needs action. **P0 = producer/consumer spelling mismatch.**

The two are paired because they're the same root cause: producer/consumer contracts are not enforced. Fixing them with a single round of contract tests (one type union, both ends importing the same `NotificationPayloadType` literal) prevents this whole class of silent-drop.

The remaining work is structural: wire the four dormant safety nets (`withJobGuards`, `OutboxService.retryFailed`, `purgeExpiredIdempotencyKeys`, the producer-side rate limit) that exist but never fire, scope secrets and add workflow-level timeouts to all 13 GitHub Actions workflows, and complete the GDPR purge field coverage.

## 1. P0 — Critical (ship before any new worker feature)

### 1.1 Rent-reminder suppression, fire-once emitter, ₹100× bug (rent-reminders.job.ts + index.ts + notification-service.ts)

**Files:**
- `web/src/server/workers/jobs/rent-reminders.job.ts:80-228` (process)
- `web/src/server/workers/index.ts:379-410` (rent-due-emitter)
- `web/src/server/workers/jobs/orphan-event-consumer.job.ts:69-85` (RENT_PAID handler)
- `web/src/server/workers/jobs/daily-engagement.job.ts:91-105` (debt riders)
- `web/src/lib/notification-service.ts:89-99` (format string)

**Findings:**

| # | Severity | Where | What |
|---|---|---|---|
| P0-A | 🔴 | `rent-reminders.job.ts:196-227` | The overdue path emits `RENT_OVERDUE` and calls `notifyPaymentReminder` without a per-lease-per-period sent-marker. The lease is **not** advanced (no debit happened) so the next minute the same lease matches the `nextRentDueAt <= now()` filter again, and the same notifications re-fire. |
| P0-B | 🔴 | `index.ts:379-410` | The rent-due-emitter checks `istHour === 6 \|\| istHour === 18` once per minute. The hour gate is **not** a fire-once guard — it fires 60×/hour during the window. The in-source comment claims "the hour gate is the dedup" but that's wrong. |
| P0-C | 🔴 | `notification-service.ts:93` | `\`Your rental payment of ₹${amount.toFixed(2)} is due.\`` assumes rupees. Callers pass paise (e.g. `lease.finalPriceInPaise` is in paise per the `inPaise` suffix convention; `daily-engagement.job.ts:96` passes `Math.abs(rider.wallet.balanceInPaise)`; `orphan-event-consumer.job.ts:74` passes `amountInPaise`). A ₹500 rent renders as **₹50000.00** (×100). All 4 call sites affected. |
| P0-D | 🔴 | `rent-reminders.job.ts:182-184` + `orphan-event-consumer.job.ts:72-76` | The auto-debit path fires `notifyPaymentReminder` directly AND emits the `RENT_PAID` outbox row. The orphan consumer's `handleRentPaid` (`:69-85`) then calls `notifyPaymentReminder` again off the outbox row. **Two push notifications + two audit rows per successful payment.** |
| P0-E | 🟠 | `index.ts:411-424` (device-violation-emitter) | Same pattern as P0-B: emitter fires every minute, the worker's emit (`device-compliance.job.ts:70-73`) is OUTSIDE the new-violation guard at line 57, and the violation-detection logic at line 41 is circular (`deviceViolationCount > 0` is the condition for a new violation). |
| P0-F | 🟠 | `index.ts` other emitters | Other emitters use the same fire-once pattern or rely on a coarse time-window; the inconsistency is the bug. |

**Fix sketch (the only design choice the user owns):**

1. **Add a sent-marker column.** New `rentalLease.overdueNotifiedAt: DateTime?` and `rentalLease.periodNo`-aware idempotency key `rent:overdue:${lease.id}:${lease.periodNo}`. The CAS pattern is the same one the debit path already uses (re-check inside tx, skip if mismatch). Modeled on the existing in-tx period advance at `rent-reminders.job.ts:135-142`.
2. **Fire-once guard on the emitter.** Add `rent-due-emitter.firedKey = "rent-due-emitter:${todayIst}"` and check the marker BEFORE the outbox emit. The producer-side outbox row is the dedup; if it's already PENDING/COMPLETED for today's date, skip.
3. **Convert `notifyPaymentReminder` to take an explicit `amountInPaise`** and divide at the presentation boundary in `notification-service.ts`. Add a `@param` JSDoc warning. Migrate the 4 call sites to pass `rentAmount` (the existing in-paise variable) and let the service format with `formatPaise(amount)`.
4. **Drop the direct `notificationService` call at `rent-reminders.job.ts:182-184`.** The outbox `RENT_PAID` row the job emits at line 152-163 is the authoritative source of truth. The orphan consumer's `handleRentPaid` is the single delivery path. This mirrors the in-tx-outbox-emit convention the rent-debit path already follows.
5. **Idempotency lock for the fire-once emitter** (or wrap in `checkOrClaimIdempotency("rent-due-emitter:${todayIst}", 86400)` for the 06:00 and 18:00 keys separately — two claim keys per day, so the second fires after the first completes).

**Why this is P0, not P1:** The `₹50000.00` push is the kind of bug a user screenshots and tweets. The emitter storm sends up to 240 push notifications/day per affected rider; the 100× currency error sends literally wrong amounts; the suppression gap means an affected rider who doesn't top up gets the same overdue push every minute for the rest of the day. All three are user-visible money/nudge bugs.

### 1.2 KYC INFO_REQUESTED silently dropped (notification-dispatch.job.ts)

**Files:**
- `web/src/server/modules/kyc/kyc.use-cases.ts:121-134` (producer)
- `web/src/server/workers/jobs/notification-dispatch.job.ts:43-56, 90-244` (consumer)
- `web/src/server/workers/jobs/notification-dispatch.job.ts:236-243` (default ack)

**Finding:**

The producer at `kyc.use-cases.ts:130-134` emits:
```ts
await OutboxService.emit(OutboxEventTypes.NOTIFICATION_SEND, {
  riderId: riderDbId,
  type: 'KYC_INFO_REQUESTED',
  infoRequest,
}, 3);
```

The dispatcher's `NotificationPayloadType` union at `notification-dispatch.job.ts:43-56` declares `KYC_INFO_REQUIRED`. The switch at `:90-244` has no `KYC_INFO_REQUESTED` case. The default branch at `:236-243`:
```ts
default: {
  const unknown = payload as { type: string };
  logger.warn('[NotificationDispatch] Unknown payload type — acking', { ... });
  return { delivered: false, channel: 'none', warning: 'unknown type' };
}
```

**Result:** every `KYC_INFO_REQUESTED` event is acked without a side effect. The OutboxEvent is marked COMPLETED. The rider is never told their KYC needs action. The `createAndSend` FCM path is also never invoked. The DB row that the dispatcher normally writes (`db.notification.create` for KYC cases at `:97-107`) is also missed.

**Fix sketch:**

1. **Add `'KYC_INFO_REQUESTED'` to the `NotificationPayloadType` union** at `notification-dispatch.job.ts:43-56`. Add a matching case at `:90-244` that calls `notificationService.notifyKycStatusChange(payload.riderId, 'INFO_REQUIRED', infoRequest)` and persists an in-app `SYSTEM` row.
2. **Extract the payload type strings to a shared constants module** (`web/src/server/workers/notification-payload-types.ts`) and import on both ends. This is the contract test the codebase has been missing — the producer and consumer both import the same literal.
3. **Alert on unknown-type acks** at the dispatcher (`:236-243`): an `alerter.send({ level: 'warn', title: 'Unknown notification payload type' })` for the first occurrence per type per hour, so a producer/consumer spelling mismatch pages the team within 1h, not silently in production forever.
4. **Add a regression test** at `web/tests/unit/workers/notification-dispatch-unknown-type.test.ts` that emits a `KYC_INFO_REQUESTED` and asserts both the FCM path was called and a `notification` row was written.

**Why this is P0, not P1:** A rider who legitimately needs to upload more info never finds out. The audit trail is silently lost. This is the same root cause as the rent-reminder 100× bug: producer/consumer contracts not enforced, bugs surface as silent user-visible failures, not crashes.

## 2. P1 — Needs work (14 findings across 8 files)

### 2.1 Scheduled backup infinite loop (scheduled-backup.job.ts:127-131 + backup.service.ts:797-837)

`calculateNextRun` returns `null` for `MANUAL` frequency or unparseable `timeOfDay`. The caller does `nextRunAt ?? clock.now()` at `:131`, which converts `null` → `now()`. The schedule runs again on the next tick = infinite loop. The disk fills up; backups are written every minute.

**Fix:** If `calculateNextRun` returns `null`, persist `nextRunAt = null` and don't reschedule (the schedule stays dormant until an admin updates it). Alternative: treat `null` as a config error and surface it in the admin "Schedules" page.

### 2.2 Referral reward double-mint on replay + self-referral + swallowed errors (referral-reward.job.ts:66-120)

- The `txn = await tx.transaction.create(...)` at `:68-78` has no `idempotencyKey`. The `walletLedgerService.credit` at `:80-87` and the `tx.reward.create` at `:89-95` have the same problem. If the job replays, three rows are duplicated per attempt. The `walletLedgerService.credit` does carry an `idempotencyKey`, so the wallet side is safe; the transaction row and the reward row are not.
- The comment at `:57-64` claims the wallet-ledger `idempotencyKey` is "the single guard that prevents a double-pay". That's true for the wallet, not for the audit-grade transaction row. A re-run produces an `APPROVED` `DEBIT/CREDIT` row that doesn't match the wallet.
- No self-referral check: `rider.id === referredRiderId` is never compared. A rider who refers themselves gets the bonus.
- `:113-120`: the catch block sets `result.errors++` and returns — the OutboxEvent is acked, no retry. A transient DB blip loses the reward permanently.

**Fix:**
1. Add `idempotencyKey: 'referral:${referrer.id}:${referredRiderId}'` to the `transaction.create` (and `reward.create`) — Prisma already has a unique constraint on the `Transaction.idempotencyKey` column; the job can rely on the same DB-level guard the wallet does.
2. Add a `rider.id === referredRiderId` self-referral guard at the top, and a `findUnique({ where: { referredBy: referredRiderId, id: referrer.id } })` linkage check to make sure the referrer is the one who actually used the code.
3. Rethrow the error from the catch block so the OutboxEvent retries; the idempotency keys make replay safe.

### 2.3 GDPR purge incomplete field coverage (data-deletion-purge.job.ts:33-86)

The `RIDER_PII_FIELDS` object at `:33-47` and the `KYC_PII_FIELDS` / `GUARANTOR_PII_FIELDS` objects at `:58-86` do not cover:
- `Rider.dob` (date of birth)
- `Rider.geolocation` / `Rider.latitude` + `Rider.longitude` (last-known location)
- `Rider.lockPasswordHash` (app-lock password hash)
- `Rider.deletionReason` (free-text "why are you leaving" — the most personal field of all)
- `RiderPickupPhoto` rows (the relational table behind the `pickupPhoto*` URLs) and the actual photo files on disk in `BACKUP_UPLOADS_ROOT` or wherever the CDN-mirror stores them
- `RiderConsent`, `RiderDevice`, `AuditLog.details` (free-text audit details) — the `details: JSON.stringify({ softDeletedAt, purgedAt, fields: [...] })` write at `:159-171` records the PII shape; that's a positive; but other audit logs that referenced the rider still carry PII in their `details` field.

**Telemetry rows linger ~37 days** because the `RiderTelemetry` model has a 30-day TTL purge at the `cleanup-telemetry` cron but the audit-log rows never expire.

**Fix:**
1. Add the missing PII fields to `RIDER_PII_FIELDS` / `KYC_PII_FIELDS` / `GUARANTOR_PII_FIELDS`.
2. Add a third pass that `tx.riderPickupPhoto.deleteMany({ where: { riderId: rider.id } })` AND walks the filesystem to `fs.unlink` the photo URLs (the `Rider.pickupPhotoFront` etc. URLs are full S3 keys; look up the storage abstraction and remove via the same `IStorageProvider` the upload path uses).
3. Scrub `AuditLog.details` for known PII keys (or just delete the rows older than 90 days that reference the rider's `entityId === rider.id`).
4. Add a `Rider.purgedAt` check at the cron level so the audit log doesn't keep logging "purged" rows on every retry.

### 2.4 KYC decision duplicated in-app + retry contract defeated (notification-dispatch.job.ts:91-131)

`notificationService.createAndSend` at `notification-service.ts:13-60` already calls `db.notification.create` (`:35-48`). The dispatcher's `KYC_APPROVED` and `KYC_REJECTED` cases (`notification-dispatch.job.ts:91-131`) call `notificationService.notifyKycStatusChange(...)` AND then call `db.notification.create` again. **Two rows per KYC decision.**

The `createAndSend` swallows all errors at `:56-59` (`return { success: false, error }`) and the dispatcher doesn't check the return value. A failed FCM push is logged as a warning but the OutboxEvent is acked — the job-queue backoff never engages. The retry contract is defeated.

**Fix:**
1. Drop the redundant `db.notification.create` at `:97-107` and `:120-127`. The single `createAndSend` call inside `notifyKycStatusChange` is the in-app persistence.
2. `createAndSend` should rethrow transient errors (network, 5xx) and silently ack only permanent errors (4xx). Make the contract explicit.
3. The dispatcher checks the return value: `{ success: false, transient: true }` → throw, `{ success: false, transient: false }` → log and ack.

### 2.5 Device-violation alert spam + circular logic (device-compliance.job.ts:41-74 + index.ts:411-424)

Covered in P0-F above. The "violation" predicate is `rider.isLocationMandatory && rider.deviceViolationCount > 0` — a violation exists because violations exist. The 7-day auto-resolve at `:78-90` resolves, then re-detects the next minute. Every minute the emitter fires → the job runs → if no NEW violation was created (line 57 guards the `db.deviceViolation.create`), the emit at `:70-73` STILL fires. **~1,440 Slack pages/day/rider** for a permanent (unresolvable) violation.

**Fix:**
1. Move the emit INSIDE the `if (!existing)` block at `:57` so the Slack page only fires on a real new violation.
2. Drop the `deviceViolationCount > 0` predicate — the correct predicate is "the rider revoked the permission since the last scan", not "there are stale violations". Read the current state from the rider's `permissionsState` JSON column (or whichever the schema uses) and compare to the last scan.
3. Add a 24h "violation-alerted" marker per (rider, permission) pair so the second alert doesn't fire for the same violation.
4. Drop the 7-day auto-resolve or move it behind a `rider.deviceViolationCount > 0` check (i.e. only auto-resolve violations that the rider has actually re-permissioned).

### 2.6 Idempotency liveness — partially fixed, two gaps remain (idempotency.ts:101-105, 138-147, 233-246)

**Already fixed (good):**
- Stale-claim stealing: `IDEMPOTENCY_STEAL_AFTER_MS = 5 * 60 * 1000` at `:15`, steal logic at `:109-136`. The re-audit notes this AUDIT FIX is in place and the previous "crash bricks the whole day" claim is no longer accurate.
- 4xx → FAILED: `api-middleware.ts:68-74` marks client-error responses as `FAILED` so the client can retry with corrected input. Already in place.

**Two gaps remain:**
1. **No scheduled caller for `purgeExpiredIdempotencyKeys` at `:233-246`.** The function exists, the table is unbounded, no cron / no worker calls it. Confirmed: `purgeExpiredIdempotencyKeys` has zero callers in `src/`. Either wire it to a daily cron or to the existing `cleanup-telemetry` / `audit-cleanup` cadence.
2. **Memory store cleanup interval is globalThis-guarded at `:20-31` but only cleans the in-memory map.** The DB rows survive. The 24h TTL for HTTP keys means the table grows by ~1 row per request per day. The hourly purge from #1 fixes this.

**Fix:**
1. Wire `purgeExpiredIdempotencyKeys()` into `cleanup-telemetry` (or a new `idempotency-cleanup` cron at `src/app/api/cron/cleanup-idempotency/route.ts`). Standard 1h cadence, scoped by `expiresAt < NOW()`.
2. Add a unit test that creates a key, fast-forwards the `expiresAt` by 1 day, and asserts the purge removes it.

### 2.7 Reaper attempts increment — already fixed (job-queue.ts:170-208)

Confirmed: the AUDIT FIX at `:175-181` increments `attempts`, honors `maxAttempts`, and preserves error context. The reaper no longer "resets attempts=0". No change needed; the re-audit closes this finding.

### 2.8 Announcements cron auth fails OPEN (cron/announcements/route.ts:8)

`if (process.env.CRON_SECRET && authHeader !== ...)` — when `CRON_SECRET` is unset, the auth check is bypassed entirely. The other 3 cron routes (`cleanup-telemetry`, `notifications`, `reconciliation`) all use `requireCronAuth(req)` from `lib/cron-auth.ts`, which is fail-closed and >=16-char secret. The announcements route is the lone drift.

**Fix:** Replace the line-8 check with `const authError = requireCronAuth(req); if (authError) return authError;` (match the other 3 routes).

### 2.9 Dead safety machinery (job-wrapper.ts, outbox.ts:338, 402-426, idempotency.ts:233-246)

| Helper | Status | Caller count |
|---|---|---|
| `withJobGuards` (job-wrapper.ts:12) | Defined, no callers | 0 |
| `OutboxService.retryFailed` (outbox.ts:402) | Defined, no callers | 0 |
| `OutboxService.emit` rate limit (outbox.ts:338) | Test-flag-gated, never set in prod | 0 (production) |
| `purgeExpiredIdempotencyKeys` (idempotency.ts:233) | Defined, no callers | 0 (covered in 2.6 above) |

**Fix:**
1. **`withJobGuards`** — either delete (preferred; the `process()` calls in each job already implement their own idempotency) or wrap every `job.process` call in the orchestrator (`index.ts`) so a single try/catch + alerter path is the standard.
2. **`OutboxService.retryFailed`** — wire to an admin endpoint or a one-shot cron that runs hourly. The function exists; the FAILED events pile up. Without a scheduled caller, the 64KB/payload outbox table grows unbounded (the failure rate of a healthy system is <1%, but FAILED events stay forever).
3. **Producer-side rate limit** — the flag `RATE_LIMIT_FORCED_ON_FOR_TESTS` is the only gate. Drop the flag, the limit (1,000 emits/min per event type per process) should be always-on. The original audit intent was to enforce the limit always; the test-only flag was a debug-time workaround that should have been reverted.

### 2.10 NotificationCleanup / outbox FAILED purge — same as 2.9 above

Re-categorize as the same root cause: half-built safety nets. The fix is the same.

### 2.11 wallet-ledger side: missing per-period sent-marker for overdue (rent-reminders.job.ts)

Same root cause as 1.1, separated because the wallet-side idempotency is fine. The fix at 1.1 covers it.

### 2.12 device-violation emit outside new-violation guard (device-compliance.job.ts:70-73)

Covered at 2.5. Same fix.

### 2.13 CI/CD — workflow-level `timeout-minutes` missing from all 13 workflows

Confirmed: the 13 workflow files all have per-job `timeout-minutes` but no workflow-level `timeout-minutes` at the `jobs:` root. Stryker (4h) and Windows emulator jobs (6h) can burn GitHub Actions minutes if a single step hangs and the per-job timeouts don't fire (e.g. the Windows emulator's SSH connection getting into a half-state where the step exits 0 but the runner never gets the signal).

**Fix:** Add `timeout-minutes: 120` to the workflow-level of the 6 long-running workflows (ci-cd, e2e-ubuntu, e2e-windows, flutter-ci-cd, nightly-load, mutation-nightly, flutter-e2e-manual). Add `timeout-minutes: 60` to the rest.

### 2.14 CI/CD — dependency-audit.yml has 5 unpinned actions (and the count claim is over)

Confirmed: the re-audit found **5 unpinned actions, all in `dependency-audit.yml`**:
- `actions/download-artifact@v4` (×2: lines 137, 144)
- `actions/github-script@v7` (×2: lines 168, 195)
- `anchore/sbom-action@v0` (line 261)

The other 12 workflows have 0 unpinned actions. The original audit said "10 mutable-tag actions" — that count appears to double-count or include comments.

The `anchore/sbom-action@v0` is the only third-party action in the set; the others are GitHub-owned first-party actions. Pin to SHA.

The `permissions: contents: read` at line 256 is correct — the original audit's "under issues: write" claim is incorrect. The job does NOT have `issues: write` permission.

**Fix:** Resolve the v4 / v7 / v0 commit SHAs and pin. Add a Dependabot config (`.github/dependabot.yml`) for GitHub Actions so this never regresses.

## 3. P2 — Minor (12 findings)

The P2s are hygiene-level: missing unit tests, magic numbers, log levels, etc. They're listed in the table at the end and are easy single-PR additions.

Notable:
- Daily-engagement payment reminder also passes paise to `notifyPaymentReminder` (line 96) — fixed by 1.1.
- Orphan-event-consumer RENT_OVERDUE handler (`:96`) — same.
- `notificationService.createAndSend` at `:13-60` — rethrow transient / ack-on-permanent (covered in 2.4).
- `scheduled-backup.job.ts:127-131` — `?? clock.now()` is also a magic number; replace with explicit `null`-branch.
- `data-deletion-purge.job.ts:33-47` — the `pickupPhoto*` fields are URL strings; the actual photo records are in a separate table. Add to 2.3.
- `device-compliance.job.ts:78-90` — the 7-day auto-resolve window is a magic number. Read from settings.
- `idempotency.ts:20-31` — the `globalThis.$_idempotencyCleanup` flag is unusual; the memory store cleanup is also a magic-number (10 min interval). Both small.
- `outbox.ts:338-344` — the test flag is dead; remove the flag entirely.
- `outbox.ts:402-426` — `retryFailed` resets `attempts: 0` and `error: null`. For FAILED events past `maxAttempts`, this is fine; for transient failures, the next run will go through the full 3 retries again. Acceptable.
- `k6-load.js` smoke + threshold — the pr-smoke-load comment at line 110-112 says "continue-on-error removed", and the re-audit confirms there's no `continue-on-error: true` in the file. **Already fixed.** The original audit's "can never fail a PR" claim is stale.
- Slack webhooks interpolated into `run:` in 4 files (daily-smoke-tests, nightly-load, mutation-nightly, plus 1 inline) — re-audit confirmed the URL is read from `${{ secrets.SLACK_WEBHOOK_URL }}` env var and the `if [ -n "$SLACK_WEBHOOK_URL" ]` guard prevents accidental execution. The `webhook url` is never logged; the `RUN_URL` and payload are env-substituted. **Safe.** The "interpolated into run:" is a stylistic note, not a security finding.
- The signed release APK retention is 14 days, not 90. The re-audit confirms the 14-day retention at `flutter-ci-cd.yml:372`. **Already shorter than reported.**

## 4. Systemic themes

1. **Half-built safety nets.** Four designed protections exist but never fire: `withJobGuards`, `FAILED purge`, `idempotency purge`, producer-side rate limit. Wiring them is higher-leverage than any new code.
2. **Duplicate sends wherever a send isn't marked atomically.** The two best in-repo patterns are `periodNo CAS` (rent-debit) and `delivery-row unique constraint` (announcement-broadcast). Replicate them in rent-overdue, referral-reward, device-violation.
3. **Emitter hygiene inconsistency.** Fire-once guards exist for engagement / reconciliation but not rent-due / device-scan. Downstream jobs inherit the multiplication.
4. **Swallowed provider errors defeat backoff.** `notificationService.createAndSend` and the `KYC_*` dispatcher cases all wrap in `.catch(() => {})`. Standardize throw-on-transient / ack-on-permanent.
5. **CI hygiene is uniform-but-absent.** Add timeout-minutes batch, SHA-pin the 6 mutable-tag files, scope secrets to jobs.

## 5. Suggested remediation order (10 PRs)

Mapped to tickets T-90..T-99 in `docs/FOLLOWUP_TICKETS.md`.

| PR | Tickets | Effort | Description |
|---|---|---|---|
| **N-P0 pair** | T-90 (rent-reminder suppression) + T-91 (KYC event-type mismatch) | 1.5 d | Rent overdue sent-marker + fire-once emitter + 100× fix + KYC_INFO_REQUESTED in dispatcher + shared payload-type constants + alert on unknown-type acks. 1 PR because both share the "producer/consumer contract" root cause. |
| **T-92** | Scheduled backup infinite loop + announcements cron auth | 0.5 d | Both small, both one-line fixes. |
| **T-93** | Referral reward integrity | 1 d | `idempotencyKey` on transaction.create + self-referral guard + rethrow. |
| **T-94** | Data-purge field scope completion | 1 d | Add missing PII fields + `RiderPickupPhoto` rows + filesystem unlink + AuditLog scrub. |
| **T-95** | KYC decision dedup + retry contract | 0.5 d | Drop redundant `db.notification.create`; rethrow transient in `createAndSend`. |
| **T-96** | Device-violation emit guard | 0.5 d | Move emit inside new-violation guard; drop circular predicate; 24h alerted-marker. |
| **T-97** | Idempotency purge wired + safety nets awake | 1 d | `purgeExpiredIdempotencyKeys` cron; remove `RATE_LIMIT_FORCED_ON_FOR_TESTS` flag; wire `retryFailed` to admin endpoint or hourly cron. |
| **T-98** | Reaper attempts increment (already done) | 0.25 d | Verify + test. |
| **T-99** | CI batch | 1 d | Workflow-level `timeout-minutes` on all 13; SHA-pin 5 dependency-audit actions; add Dependabot; tighten release APK retention. |
| **Polish** | (deferred) | 1 d | Magic numbers, copy consistency, l10n. |

**Total focused effort:** ~7.25 d. P0s shippable in PR-1 (T-90/T-91, 1.5 d) within 2 days.

## 6. Verified clean / exemplary (8 areas)

- **Job claim atomicity.** `web/src/lib/job-queue.ts` (the `FOR UPDATE SKIP LOCKED` claim) is parameterized SQL, no injection, no cross-process double-claim. Reference implementation.
- **cron-auth.ts is a reference implementation.** Fail-closed, >=16-char secret, SHA-256 + `timingSafeEqual`. Internal worker route is fail-closed both ways. The only drift is the announcements cron (T-92).
- **Backoff math + maxAttempts enforcement** is arithmetically correct end-to-end (`job-queue.ts:130-164`).
- **Every polling loop error-isolated** — nothing can permanently wedge dispatch.
- **Reconciliation jobs strictly report-only** — auto-heal deliberately removed (the team decided in 2026-07-29 audit that auto-heal was the wrong default for money data; only humans reconcile).
- **Integer-paise math throughout** the wallet, ledger, and reconciliation paths.
- **Data-deletion purge:** grace period enforced, strictly scoped per-rider, audit written atomically in-tx.
- **Rent-debit path** is exemplary (periodNo CAS + unique idempotency key + in-tx outbox emit). Replicate the pattern.
- **Announcement-broadcast's** subtraction+unique+`skipDuplicates` retry design is the pattern to copy for FCM-bound sends.
- **CI/CD (13 workflows — strong overall):**
  - ✅ Zero pwn-request surface (no `pull_request_target` / `workflow_run` anywhere — confirmed)
  - ✅ No prod hosts hit by load tests (all target `127.0.0.1`)
  - ✅ No secrets echoed in logs
  - ✅ Keystore lifecycle exemplary (`flutter-ci-cd.yml:374-388`: overwrite with urandom, then delete)
  - ✅ `permissions:` blocks present on all 13 (lowest-privilege pattern)
  - ✅ Concurrency groups + `cancel-in-progress: true` on PR workflows
  - ✅ Daily-smoke-tests, nightly-load, pr-smoke-load all run against ephemeral test DBs

## 7. Files touched across the 10 PRs

- `web/src/server/workers/jobs/rent-reminders.job.ts` (T-90)
- `web/src/server/workers/jobs/orphan-event-consumer.job.ts` (T-90)
- `web/src/server/workers/jobs/daily-engagement.job.ts` (T-90, passes paise)
- `web/src/server/workers/jobs/notification-dispatch.job.ts` (T-90, T-91, T-95)
- `web/src/server/workers/jobs/referral-reward.job.ts` (T-93)
- `web/src/server/workers/jobs/data-deletion-purge.job.ts` (T-94)
- `web/src/server/workers/jobs/device-compliance.job.ts` (T-96)
- `web/src/server/workers/jobs/scheduled-backup.job.ts` (T-92)
- `web/src/server/workers/index.ts` (T-90, T-92, T-96)
- `web/src/server/workers/outbox.ts` (T-97)
- `web/src/server/modules/kyc/kyc.use-cases.ts` (T-90)
- `web/src/lib/notification-service.ts` (T-90, T-95)
- `web/src/lib/idempotency.ts` (T-97)
- `web/src/app/api/cron/announcements/route.ts` (T-92)
- `web/src/app/api/cron/cleanup-idempotency/route.ts` (T-97, new file)
- `prisma/schema.prisma` (T-90: `rentalLease.overdueNotifiedAt`)
- `.github/workflows/*.yml` (T-99, all 13)
- `.github/dependabot.yml` (T-99, new file)

## 8. Out of scope for this audit

- Front-end (covered by `docs/AUDIT_FLUTTER_2026-08-22.md`)
- Admin web panel (covered by `docs/AUDIT_ADMIN_2026-08-21.md`)
- Database schema (covered by `docs/AUDIT_DATABASE.md`)
- API surface (covered by `docs/AUDIT_API_DEEP.md`)
- iOS / Android native shells
- Top-level shell (`docs/AUDIT_TOP_LEVEL_SHELL_2026-07-30.md`)
- Dependabot config (added in T-99)

## 9. Appendices

### 9.1 Finding re-verification

All P0/P1 findings in this doc have been re-verified against the current `main` on 2026-08-23 by reading the file and line numbers. Where the re-audit contradicted the original report (workflow timeouts claim, anchore permission claim, 14-day vs 90-day retention, pr-smoke-load continue-on-error, idempotency liveness), the contradiction is called out explicitly.

### 9.2 Already-fixed items (good — re-audit confirms)

- Stale-claim stealing (`idempotency.ts:109-136`)
- 4xx → FAILED (`api-middleware.ts:68-74`)
- Reaper attempts increment (`job-queue.ts:182-203`)
- DATABASE_URL scoped to job, not workflow-level (`ci-cd.yml:157-161`)
- pr-smoke-load `continue-on-error` removed (`pr-smoke-load.yml:104-117`)

### 9.3 What's NOT in this audit (already done in earlier phases)

- 2026-07-29 worker audit (`docs/AUDIT_WORKERS.md`, 10-PR plan) — 3 of 13 P0s fixed in PR-P1.4 (JobQueue.enqueue + JobTypes)
- Riverpod v3 migration (`docs/PROVIDER_MIGRATION.md`)
- Performance recommendations (`docs/PERF_RECOMMENDATIONS_2026-08-01.md`)
- Infrastructure (`docs/AUDIT_INFRASTRUCTURE.md`)
- Security (`docs/AUDIT_SECURITY.md`)
