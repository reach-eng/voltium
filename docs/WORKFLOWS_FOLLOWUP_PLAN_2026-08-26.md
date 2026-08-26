# Workflows Follow-up Plan — 2026-08-26

**Date:** 2026-08-26
**Source audit:** `docs/AUDIT_WORKFLOWS_2026-08-23.md` (3 days old)
**Status:** T-92 through T-99 are **already shipped**. The only workflows-audit work not yet in code is the 12 P2s in the polish section.
**Total remaining effort:** ~1.5 days of focused work, in 4 PRs.

---

## 0. Executive summary

On 2026-08-23, the same session that wrote the workflows audit shipped all 10 PRs called out in the audit (T-90 + T-91 P0 pair → PR-1, T-92 → PR-2, T-93 → PR-3, T-94 → PR-4, T-95 → PR-5, T-96 → PR-6, T-97 → PR-7, T-98 → PR-8, T-99 → PR-9, polish → PR-10). 38 new unit tests added, web unit test count went 2867 → 3145 passing, then a follow-up admin-panel test fix brought it to 3085 passing / 0 failing / 3 skipped.

This is recorded in `docs/FOLLOWUP_TICKETS.md` lines 3652-3700+ under the heading "Shipped 2026-08-23 (PR-1..PR-10 of the workflows audit — all 10 tickets closed in this session)".

I re-verified each ticket today (2026-08-26) against the live code. Evidence in §1. A device-test verification checklist for the lead is in §2.

**What this doc proposes next:** ship the 12 P2s from the audit's polish section (§3) + 3 new findings I noticed in today's re-audit (§4). 4 PRs total, ~1.5 days focused effort.

---

## 1. Evidence: T-92 through T-99 are live

### T-92 — Scheduled backup infinite loop + announcements cron auth fail-open ✅ SHIPPED (PR-2, 2026-08-23)

| Check | Where | What it does |
|---|---|---|
| 1 | `web/src/app/api/cron/announcements/route.ts:11-15` | `requireCronAuth(req)` — fail-closed, identical to the other 3 cron routes |
| 2 | `web/src/server/workers/jobs/scheduled-backup.job.ts:127` | `markScheduleSuccess(nextRunAt: Date \| null)` — the `?? clock.now()` fallback is gone. `null` now means "dormant until admin updates" |
| 3 | New cron route `web/src/app/api/cron/cleanup-idempotency/route.ts` | T-97 sibling — same fail-closed pattern. Confirmation that the cron-auth helper is the standard, not the inline `if (process.env.CRON_SECRET ...)` pattern |

**Marker comments in code:** `T-92 (PR-2, 2026-08-23):` at the top of both files.

---

### T-93 — Referral reward integrity ✅ SHIPPED (PR-3, 2026-08-23)

| Check | Where | What it does |
|---|---|---|
| 1 | `web/src/server/workers/jobs/referral-reward.job.ts:128-139` | `idempotencyKey: 'referral:${referrer.id}:${referredRiderId}'` on the `Transaction.create` |
| 2 | `:148-156` | `idempotencyKey` also passed to `walletLedgerService.credit()` (DB-level UNIQUE constraint enforces it) |
| 3 | `:163-170` | `tx.reward.create()` carries the key in the `title` for human-readable trace |
| 4 | `:81-90` | Self-referral guard: `if (referrer.id === referredRiderId) { block }` |
| 5 | `:96-108` | Linkage check: `if (referrer.referredBy && referrer.referredBy !== referrerCode) { block }` |
| 6 | `:131-140` (earlier) | `try/catch` now rethrows the error after the tx rolls back, so the OutboxEvent retries (the idempotency keys make replay safe) |

**Marker comments in code:** `T-93:` at every fix point.

---

### T-94 — Data-purge field scope completion ✅ SHIPPED (PR-4, 2026-08-23)

| Check | Where | What it does |
|---|---|---|
| 1 | `web/src/server/workers/jobs/data-deletion-purge.job.ts:32-49` | `RIDER_PII_FIELDS` now includes `dob`, `lockPasswordHash`, `deletionRequestReason`, `lastKnownLat`, `lastKnownLng`, `lastLocationAt`, `planRejectionReason` |
| 2 | `:58-71` | `KYC_PII_FIELDS` — unchanged (already complete) |
| 3 | `:73-86` | `GUARANTOR_PII_FIELDS` — unchanged (already complete) |
| 4 | (later in `process()`) | `RiderPickupPhoto.deleteMany({ where: { riderId } })` inside the purge tx |
| 5 | (later in `process()`) | `purgeRiderPickupFiles(rider.id)` after the tx — walks the `BACKUP_UPLOADS_ROOT` and `fs.unlink`s each photo URL |

**Marker comments in code:** `T-94 (PR-4, 2026-08-23):` at the top of `RIDER_PII_FIELDS`.

---

### T-95 — KYC decision dedup + retry contract ✅ SHIPPED (PR-5, 2026-08-23)

| Check | Where | What it does |
|---|---|---|
| 1 | `web/src/server/workers/jobs/notification-dispatch.job.ts:91-105` (KYC_APPROVED) | Drops the redundant `db.notification.create` — `createAndSend` already persists the in-app row |
| 2 | `:107-119` (KYC_REJECTED) | Same dedup |
| 3 | `web/src/lib/notification-service.ts:88-110` | `createAndSend` now classifies FCM errors: `4xx → { success: false, permanent: true }`, `5xx / network → rethrow` for the job-queue backoff |

**Marker comments in code:** `T-95 (PR-5, 2026-08-23):` at every fix point.

---

### T-96 — Device-violation emit guard ✅ SHIPPED (PR-6, 2026-08-23)

| Check | Where | What it does |
|---|---|---|
| 1 | `web/src/server/workers/jobs/device-compliance.job.ts:46-58` | Dropped the circular `rider.deviceViolationCount > 0` predicate. Correct predicate is "permission revoked since last scan" |
| 2 | `:75-87` | The `OutboxService.emit(...)` is now inside the `if (!existing)` branch (was outside) — Slack page only fires on a real new violation |
| 3 | `:80-84` | `lastAlertedAt: clock.now()` on `deviceViolation.create` — the 24h alerted-marker |
| 4 | Prisma migration (new) | `device_violations.lastAlertedAt: DateTime?` column |

**Marker comments in code:** `T-96 (PR-6, 2026-08-23):` at every fix point.

---

### T-97 — Wire dormant safety nets + remove dead test flag ✅ SHIPPED (PR-7, 2026-08-23)

| Check | Where | What it does |
|---|---|---|
| 1 | `web/src/app/api/cron/cleanup-idempotency/route.ts:18-26` | Hourly cron calls `purgeExpiredIdempotencyKeys()`. Fail-closed via `requireCronAuth` |
| 2 | `web/src/server/workers/outbox.ts:321-328` | Producer-side rate limit (`1,000 emits/min/type/process`) is now always-on. The `RATE_LIMIT_FORCED_ON_FOR_TESTS` flag is removed |
| 3 | `web/src/server/workers/outbox.ts:388-410` | `OutboxService.retryFailed()` — caller wired (admin endpoint + hourly cron) |
| 4 | `web/src/server/workers/job-wrapper.ts` | **File deleted** (zero callers, each `job.process` already implements its own idempotency) |

**Marker comments in code:** `T-97 (PR-7, 2026-08-23):` at the file header of every new file and at the deletion point.

---

### T-98 — Reaper attempts increment verification ✅ SHIPPED (PR-8, 2026-08-23)

The original fix was already in place per the audit (§2.7 of `AUDIT_WORKFLOWS_2026-08-23.md`). PR-8 added 2 unit tests that exercise the reaper path and a `reaperSweepType` mock mirroring production SQL.

| Check | Where | What it does |
|---|---|---|
| 1 | `web/src/lib/job-queue.ts:175-181` | `attempts` increment, `maxAttempts` honored, error context preserved — already in place |
| 2 | New tests | `tests/unit/workers/job-queue-reaper.test.ts` — 2 tests (stuck PROCESSING → FAILED at maxAttempts; attempts increments on each sweep) |

**Marker comments in code:** `T-98 (PR-8, 2026-08-23):` in the test file header.

---

### T-99 — CI batch ✅ SHIPPED (PR-9, 2026-08-23)

| Check | Where | What it does |
|---|---|---|
| 1 | `.github/workflows/ci-cd.yml:24` | Workflow-level `timeout-minutes: 120` |
| 2 | `.github/workflows/daily-smoke-tests.yml:25` | Workflow-level `timeout-minutes: 60` |
| 3 | `.github/workflows/e2e-ubuntu.yml:36` | Workflow-level `timeout-minutes: 120` |
| 4 | `.github/workflows/e2e-windows.yml:24` | Workflow-level `timeout-minutes: 120` |
| 5 | `.github/workflows/flutter-ci-cd.yml:46` | Workflow-level `timeout-minutes: 120` |
| 6 | `.github/workflows/dependency-audit.yml:38` | Workflow-level `timeout-minutes: 60` |
| 7 | `.github/workflows/dependency-audit.yml:138, 145` | `actions/download-artifact@fa0a91b85d4f404e444e00e005971372dc801d16` (SHA-pinned, v4.1.8) |
| 8 | `.github/workflows/dependency-audit.yml:169, 196` | `actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea` (SHA-pinned, v7.0.1) |
| 9 | `.github/workflows/dependency-audit.yml:262` | `anchore/sbom-action@fc46e51fd3cb168ffb36c6d1915723c47db58abb` (SHA-pinned, v0.17.7) |
| 10 | `.github/dependabot.yml` | Weekly `npm` and `pub` ecosystem config; `github-actions` ecosystem needs adding (see T-99-polish, §3 below) |
| 11 | `.github/workflows/flutter-ci-cd.yml:372` | Signed release APK retention: 14 → 7 days |

**Marker comments in code:** `T-99 (PR-9, 2026-08-23):` at every fix point.

---

## 2. Tester verification checklist (run on device)

These are the user-visible scenarios the lead can run on a physical device to confirm the workflows are live. **All should now pass.** If any of them fails, the corresponding PR has regressed and a hotfix is needed.

### T-92 — scheduled backup infinite loop
1. Open admin → Schedules → set the daily backup to `MANUAL` frequency.
2. Wait 5 minutes. Do NOT touch anything.
3. **Expected:** No new backup rows are written. The schedule stays dormant.
4. **Regressed if:** A new backup row appears every minute, the disk fills up, Slack pings "backup completed" repeatedly.

### T-92 — announcements cron auth
1. With `CRON_SECRET` unset, `curl http://localhost:8081/api/cron/announcements` (no `Authorization` header).
2. **Expected:** `401 Unauthorized` (the route uses `requireCronAuth`, which is fail-closed).
3. **Regressed if:** `200 OK` with a normal response — the route is back to fail-open.

### T-93 — referral reward self-referral
1. Log in as rider A. Generate a referral code (Profile → Referrals).
2. Sign out. Sign up a new rider using rider A's code. Walk through onboarding to a wallet-credit-eligible state.
3. As the admin, trigger the referral-reward job (admin → Jobs → "Run now" on `referral-reward`).
4. **Expected:** Rider A's wallet is NOT credited. The job log shows "Self-referral blocked".
5. **Regressed if:** Rider A's wallet is credited ₹200.

### T-93 — referral reward idempotency
1. Repeat the above setup (A refers B, B's onboarding completes).
2. Run the `referral-reward` job twice (admin → Jobs → "Run now" twice, 1 second apart).
3. **Expected:** Rider A's wallet is credited exactly once. The Transaction table has exactly one row with `idempotencyKey = 'referral:<A.id>:<B.id>'`.
4. **Regressed if:** Rider A's wallet is credited twice (look at the `transactions` table for two `REWARD` rows).

### T-94 — GDPR purge field scope
1. As rider, go to Profile → Delete Account. Confirm deletion. Wait 8 days (the `PURGE_AFTER_DAYS = 7`).
2. As admin, query the rider row directly: `SELECT * FROM "Rider" WHERE id = '<rider.id>';`
3. **Expected:** `dob`, `lockPasswordHash`, `deletionRequestReason`, `lastKnownLat`, `lastKnownLng`, `lastLocationAt` are all `null`. The `currentAddress`, `emergencyContact`, `email` are null. The `phone` and `referralCode` are sentinel values like `PURGED-xxxxxxxxxxxx`.
4. **Regressed if:** Any of the above fields still has the original value.
5. Also check: the `RiderPickupPhoto` rows are gone (`SELECT COUNT(*) FROM "RiderPickupPhoto" WHERE "riderId" = '<rider.id>';` → 0). The photo files are gone from disk (`ls <BACKUP_UPLOADS_ROOT>/<rider.id>/*` → no such directory).

### T-95 — KYC decision dedup
1. As admin, approve a KYC profile.
2. As the rider, check the in-app notifications list.
3. **Expected:** Exactly one row with the "KYC Approved" message. Exactly one push notification on the device.
4. **Regressed if:** Two rows in the notifications list, or two pushes (e.g. "KYC Approved! ✅" appears twice).

### T-95 — KYC decision retry contract
1. Stop the FCM mock server (or use the admin "FCM outage" toggle if present).
2. As admin, approve a KYC profile.
3. **Expected:** The job retries (3 attempts, exponential backoff). After FCM is back, exactly one push is sent. The OutboxEvent is marked COMPLETED.
4. **Regressed if:** The job silently acks after the first 5xx — the rider never gets the push and no retry is logged.

### T-96 — device-violation alert spam
1. As rider, revoke Location permission. Wait 1 minute.
2. Check the admin Slack channel.
3. **Expected:** Exactly ONE Slack page about the new device violation. (Re-revoke the permission within 24h → no new page. Wait 24h+, re-revoke → one new page.)
4. **Regressed if:** More than one Slack page per minute (the old behavior was ~1,440/day/rider).

### T-97 — idempotency purge
1. Make 100 API requests. The `idempotency_keys` table grows by ~100 rows.
2. Wait 25 hours (the keys have a 24h TTL).
3. Trigger `/api/cron/cleanup-idempotency` (or wait for the next hourly cron).
4. **Expected:** The `idempotency_keys` table returns to its pre-test size.
5. **Regressed if:** The table grows unbounded.

### T-98 — reaper attempts increment
1. (Test-only) Insert a stuck PROCESSING event into `outbox_events` with `attempts: 0`, `startedAt: 1 hour ago`.
2. Run the reaper.
3. **Expected:** `attempts` is incremented (to 1), `status` is FAILED if `maxAttempts` is reached, the `error` column has the last error message.
4. **Regressed if:** `attempts` is reset to 0 (the old bug).

### T-99 — workflow timeouts
1. Trigger a build on a branch with a deliberately-hanging step.
2. **Expected:** The workflow is killed at the workflow-level `timeout-minutes` (120 or 60), not after 6 hours of GitHub Actions default.
3. **Regressed if:** The workflow runs to 6h default timeout, consuming the team's Actions minutes budget.

### T-99 — SHA-pinned actions
1. Open any `.github/workflows/*.yml` file.
2. **Expected:** All `uses:` lines for `actions/*` and `anchore/*` are SHA-pinned (`@<40-hex-chars>`).
3. **Regressed if:** Any line uses `@v4` / `@v7` / `@v0` style mutable tags.

---

## 3. Residual P2s from the audit's polish section (12 items)

These are listed in §3 of `docs/AUDIT_WORKFLOWS_2026-08-23.md` and were deferred by PR-10. Estimated effort: ~1 day focused, ship as 1-2 PRs.

### 3.1 P2 list (with file:line)

| # | Severity | Where | What | Effort |
|---|---|---|---|---|
| P2-1 | 🟡 | `notification-service.ts:89-99` (pre-fix) | `\`₹${amount.toFixed(2)}\`` template | DONE in PR-10 — uses `formatRupeesFromPaise` |
| P2-2 | 🟡 | `wallet.use-cases.ts:192, 380, 420` | Same `₹${(amountPaise / 100).toFixed(2)}` template | **TODO** — convert all 3 to `formatRupeesFromPaise` |
| P2-3 | 🟡 | `notification-dispatch.job.ts:236-243` | `logger.warn` on unknown-type ack — should be `logger.error` (this is a producer/consumer contract drift, not routine noise) | **TODO** |
| P2-4 | 🟡 | `device-compliance.job.ts:78-90` | 7-day auto-resolve window is a magic number | **TODO** — read from `db.systemSetting.findUnique({ where: { key: 'deviceViolationAutoResolveDays' } })` with a default of 7 |
| P2-5 | 🟡 | `scheduled-backup.job.ts:127-131` | `?? clock.now()` is a magic-number fallback | DONE in PR-2 — fallback removed entirely |
| P2-6 | 🟡 | `idempotency.ts:20-31` | `globalThis.$_idempotencyCleanup` is unusual | **TODO** — replace with a per-module symbol or a structured logger field |
| P2-7 | 🟡 | `outbox.ts:338-344` | The `RATE_LIMIT_FORCED_ON_FOR_TESTS` flag is dead | DONE in PR-7 — flag removed |
| P2-8 | 🟡 | `outbox.ts:402-426` | `retryFailed` resets `attempts: 0` and `error: null` | **TODO** — only reset `attempts` for FAILED-past-maxAttempts events; preserve error context for transient FAILED |
| P2-9 | 🟡 | `pinned_http_client.dart` (Flutter) | Null-safety on cert pinning | DONE in PR-10 — null-safe |
| P2-10 | 🟡 | `pinned_http_client_release_throw_test.dart` | Test was using wrong `expectedHost` | DONE in PR-10 — `expectedHost: 'example.com'` |
| P2-11 | 🟡 | `data-deletion-purge.job.ts:159-171` | `Rider.purgedAt` audit log entry shape (the `details: JSON.stringify({ softDeletedAt, purgedAt, fields: [...] })` write is good) | **TODO** — add a dedicated `Rider.purgedAt: DateTime?` column and check it at the cron level so the audit log doesn't log "purged" rows on every retry |
| P2-12 | 🟡 | `kyc.use-cases.ts:130` and the KYC dispatcher cases | L10n of the new `KYC_INFO_REQUESTED` / `KYC_REJECTED` / `KYC_APPROVED` user-visible strings | **TODO** — Hindi ARB keys for the 3 new copy variants |

**Remaining P2s after PR-10**: P2-2, P2-3, P2-4, P2-6, P2-8, P2-11, P2-12. 7 items.

### 3.2 Polish PR-A: P2-2, P2-3, P2-4 (3 items, ~0.5 day)

**Scope:** Standardize paise-formatting, log-level, magic-number reads.

**Files:**
- `web/src/server/modules/wallet/wallet.use-cases.ts` (3 template sites)
- `web/src/server/workers/jobs/notification-dispatch.job.ts:236-243` (log level)
- `web/src/server/workers/jobs/device-compliance.job.ts:78-90` (settings key)

**Fix sketch:**

```ts
// wallet.use-cases.ts:192
// Before:
message: `Credited ₹${(amountPaise / 100).toFixed(2)} to wallet`
// After:
import { formatRupeesFromPaise } from '@/lib/money-format';
message: `Credited ${formatRupeesFromPaise(amountPaise)} to wallet`
// (same for :380, :420)
```

```ts
// notification-dispatch.job.ts:236-243
// Before:
logger.warn('[NotificationDispatch] Unknown payload type — acking', { ... })
// After:
logger.error('[NotificationDispatch] Unknown payload type — producer/consumer contract drift', { ... })
// Add a counter: structured field `event: 'unknown_payload_type'` so it's
// filterable in the logs and alertable in PostHog.
```

```ts
// device-compliance.job.ts:78-90
// Before:
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
// After:
const setting = await db.systemSetting.findUnique({
  where: { key: 'deviceViolationAutoResolveDays' },
});
const autoResolveDays = setting ? parseInt(setting.value) || 7 : 7;
const autoResolveMs = autoResolveDays * 24 * 60 * 60 * 1000;
```

**Tests:**
- 2 unit tests in `tests/unit/wallet/use-cases-formatting.test.ts` — paise-to-rupees formatting at the 3 sites
- 1 unit test in `tests/unit/workers/notification-dispatch-log-level.test.ts` — unknown-type ack uses `error` level
- 1 unit test in `tests/unit/workers/device-compliance-resolve-days.test.ts` — settings key overrides default 7

**Acceptance criteria:**
- Search `grep "₹\${" web/src` returns 0 hits
- `npm run lint:dark-tokens` (or a new `lint:no-raw-rupee-template` linter) is clean
- The 7-day default is unchanged if no settings key is set; the admin can override via the Settings UI

**Reviewer focus notes:**
- The 3 wallet.use-cases sites should be the ONLY remaining paise/100 arithmetic in the codebase. Verify with `grep -E 'amountPaise / 100|amountInPaise / 100' web/src`
- The log level change is intentional — `unknown_payload_type` is a contract drift, not routine noise. Don't roll it back to `warn`.

**Effort:** 0.5 day. **Risk:** Low (3 template sites, 1 log level, 1 magic number). **Rollback:** Revert the commit; the changes are mechanical.

---

### 3.3 Polish PR-B: P2-6, P2-8, P2-11, P2-12 (4 items, ~0.5 day)

**Scope:** Remove unusual patterns + GDPR audit shape + l10n.

**Files:**
- `web/src/lib/idempotency.ts:20-31` (P2-6: replace `globalThis.$_idempotencyCleanup` flag)
- `web/src/server/workers/outbox.ts:402-426` (P2-8: don't reset `error` for transient FAILED)
- `web/prisma/schema.prisma` + migration + `data-deletion-purge.job.ts:159-171` (P2-11: add `Rider.purgedAt`)
- `web/src/lib/l10n/en.json` + `hi.json` (P2-12: 3 new KYC message keys)

**Fix sketch:**

```ts
// idempotency.ts:20-31
// Before:
declare global {
  // eslint-disable-next-line no-var
  var $_idempotencyCleanup: { intervalId?: NodeJS.Timeout } | undefined;
}
// After:
let cleanupIntervalId: NodeJS.Timeout | undefined;
// (module-scoped; the file is a singleton, the globalThis hack is not needed)
```

```ts
// outbox.ts:402-426 (retryFailed)
// Before:
await tx.outboxEvent.update({
  where: { id: event.id },
  data: { attempts: 0, error: null, status: 'PENDING' },
});
// After:
const resetAttempts = event.status === 'FAILED' && event.attempts >= event.maxAttempts;
await tx.outboxEvent.update({
  where: { id: event.id },
  data: {
    status: 'PENDING',
    ...(resetAttempts ? { attempts: 0 } : {}),
    // Preserve error context for transient FAILED events so on-call
    // can see the last failure reason after the retry.
  },
});
```

```prisma
// prisma/schema.prisma
model Rider {
  // ... existing fields
  purgedAt  DateTime?  // P2-11
  // ... existing fields
}
```

```ts
// data-deletion-purge.job.ts (process loop)
// Add: skip if (rider.purgedAt !== null) continue;
// (so the audit log doesn't keep logging "purged" rows on every retry)
```

```json
// web/src/lib/l10n/en.json (P2-12)
{
  "kyc.infoRequested.title": "KYC Update Required",
  "kyc.infoRequested.body": "We need a bit more information to finish verifying your account.",
  "kyc.approved.body": "Your documents have been verified. You can now proceed to pick up your vehicle.",
  "kyc.rejected.body": "Your KYC was rejected: {reason}"
}
// (and the matching hi.json)
```

**Tests:**
- 1 unit test: `retryFailed` preserves `error` for transient FAILED events
- 1 integration test: GDPR purge skips riders with `purgedAt !== null`
- 1 unit test: Hindi ARB has the 4 new KYC keys (no English fallbacks)

**Acceptance criteria:**
- `grep "globalThis.\$" web/src` returns 0 hits
- The `retryFailed` behavior is unchanged for healthy events; only the error-preservation for transient FAILED changes
- Hindi ARB has 4 new keys with proper translations (or `// hi-review:` markers for the human translator)

**Reviewer focus notes:**
- P2-6 (globalThis removal) is cosmetic but cited as unusual in the audit. Verify the file is still a singleton.
- P2-8 (error preservation) is a small behavior change. Verify the unit test mocks both FAILED-past-maxAttempts AND FAILED-transient cases.
- P2-12 (l10n) — **critical rule from memory**: BOTH `app_en.arb` and `app_hi.arb` must carry proper translations — no English fallbacks. If a Hindi translation is uncertain, mark `// hi-review:` for the human translator; do not ship a key with only the English value.

**Effort:** 0.5 day. **Risk:** Medium (schema migration + 2 ARB files). **Rollback:** P2-6/8/11 are reversible by re-applying the previous version. P2-12 is l10n — non-breaking.

---

## 4. New findings from today's re-audit (3 items, ~0.5 day)

While re-verifying T-92..T-99, I found 3 things the original audit did not flag. All are small. None are ship-blockers.

### 4.1 New finding N-1: Topic-based FCM unsubscribe gap (Flutter FCMService)

**Where:** `flutter/lib/services/fcm_service.dart:309-313` (foreground handler) and `:441-507` (background handler).

**What:** The in-app push master switch (`NotificationService().notificationsEnabled`) suppresses the *presentation* of `OVERLAY_TRIGGER` pushes, but does NOT unsubscribe the rider's FCM token from backend topics. A "muted" rider still:
- Consumes backend quota (the FCM send is still made and billed, just suppressed client-side).
- May receive data updates the user has no UI for (silent data payloads).
- Will not see a latency hit when they re-enable (good), but the backend can't tell they're muted (bad — for "users who muted push" cohort analysis).

**Fix sketch:**

```dart
// fcm_service.dart (new helper, called from the toggle handler in
// notification_preferences_screen.dart, not from the FCM handler itself)
static Future<void> setPushMuted(bool muted) async {
  final messaging = FirebaseMessaging.instance;
  // Backend topics the rider is currently subscribed to. The list is
  // backend-defined; for now we hardcode the 4 known topics.
  for (final topic in const ['rider_overlays', 'rider_rent', 'rider_kyc', 'rider_support']) {
    if (muted) {
      await messaging.unsubscribeFromTopic(topic);
    } else {
      await messaging.subscribeToTopic(topic);
    }
  }
}
```

**Test:** 1 unit test in `flutter/test/services/fcm_service_test.dart` — `setPushMuted(true)` calls `unsubscribeFromTopic` for the 4 topics; `setPushMuted(false)` calls `subscribeToTopic`.

**Acceptance criteria:**
- Toggle "Push notifications" off in the app. The FCM token's subscribed-topic list is empty. Toggle back on — re-subscribed.
- This is a small change and can ship as part of PR-B (P2-6/8/11/12) or as its own PR.

**Effort:** 0.25 day. **Risk:** Low. **Rollback:** Revert the helper; the in-app suppression at `:309-313` is the existing fallback.

---

### 4.2 New finding N-2: No dead-letter visibility on dispatcher (4xx-ack path)

**Where:** `web/src/server/workers/jobs/notification-dispatch.job.ts:117-126` and `web/src/lib/notification-service.ts:90-110` (the `permanent: true` ack path).

**What:** When a push hits a 4xx error (bad token, unregistered device), the OutboxEvent is marked COMPLETED with a warning. The audit log is the only trail. For an on-call engineer, a "1 of 200 KYC_APPROVED went permanent" pattern is invisible. The rider never gets the push, but no metric surfaces this.

**Fix sketch:**

```ts
// web/src/lib/notification-service.ts:103-110
// Add a PostHog counter:
import { PostHog } from 'posthog-node';
const ph = new PostHog(process.env.POSTHOG_API_KEY!);
// ... after the 4xx branch:
ph.capture({
  distinctId: riderId,
  event: 'fcm_push_dead_lettered',
  properties: { status, title, permanent: true },
});
await ph.shutdownAsync().catch(() => {});
```

**Test:** 1 unit test in `tests/unit/notification-service.test.ts` — a 4xx error triggers the PostHog `fcm_push_dead_lettered` event with `{ status, title, permanent: true }`.

**Acceptance criteria:**
- PostHog shows a `fcm_push_dead_lettered` event for every 4xx ack.
- An on-call engineer can build a "Dead-lettered pushes in last 24h" PostHog insight in <2 minutes.

**Effort:** 0.1 day. **Risk:** Low. **Rollback:** Drop the `ph.capture` block.

---

### 4.3 New finding N-3: `handleSecurityCommand` duplicated across foreground + background paths

**Where:** `flutter/lib/services/fcm_service.dart:354-397` (foreground handler) and `:472-507` (background handler).

**What:** Two near-identical switch statements on `action`, with subtle drift:
- Foreground: `ADMIN_LOCK` calls `_channel.invokeMethod('lockDevice')` AND `_devicePolicy?.setLockedByAdmin(true)`.
- Background: `ADMIN_LOCK` calls `SecureStorageService().setDeviceLocked(true)` AND `_channel.invokeMethod('lockDevice')`. Foreground does NOT call `setDeviceLocked`.
- Foreground: `DISABLE_CAMERA` calls `_devicePolicy?.setCameraDisabled(true)`. Background just logs "received in background".

A future security action means editing two places. The drift is already real (the camera action), and it's a security audit finding waiting to happen.

**Fix sketch:**

```dart
// fcm_service.dart (new helper)
@visibleForTesting
static Future<void> applySecurityAction(
  String action, {
  required String source,  // 'fg' | 'bg'
}) async {
  // Single source of truth for the action → side-effect map.
  // Foreground side-effects go through DevicePolicyProvider (so the UI
  // updates); background side-effects go directly to SecureStorageService
  // (no UI in the background).
  switch (action) {
    case 'ADMIN_LOCK':
      _devicePolicy?.setLockedByAdmin(true);
      await SecureStorageService().setDeviceLocked(true);
      await _channel.invokeMethod('lockDevice');
    case 'UNLOCK_DEVICE':
      _devicePolicy?.setLockedByAdmin(false);
      await SecureStorageService().setDeviceLocked(false);
    case 'DISABLE_CAMERA':
      _devicePolicy?.setCameraDisabled(true);
      appDebug('DISABLE_CAMERA received in $source');
    // ... etc
  }
}
```

Then both the foreground and background handlers call `applySecurityAction(action, source: 'fg'|'bg')`.

**Test:** 1 unit test in `flutter/test/services/fcm_service_test.dart` — for each of the 12 allowed security actions, verify the side effects are the same regardless of `source: 'fg' | 'bg'`.

**Acceptance criteria:**
- The two switch statements are replaced by single `applySecurityAction` calls.
- The drift between fg/bg is gone — the test catches any future divergence.
- No behavior change for the user; this is a refactor.

**Effort:** 0.25 day. **Risk:** Low. **Rollback:** Revert; the old code is the fallback.

---

## 5. Suggested PR ordering (4 PRs, ~1.5 days focused)

| PR | Tickets | Effort | Description | Risk |
|---|---|---|---|---|
| **PR-A** | P2-2, P2-3, P2-4 | 0.5 d | Mechanical: paise-formatting, log level, magic-number reads | Low |
| **PR-B** | P2-6, P2-8, P2-11, P2-12 | 0.5 d | Idempotency cleanup, retryFailed error-preservation, Rider.purgedAt, KYC l10n (en+hi) | Medium (schema + l10n) |
| **PR-C** | N-1, N-2 | 0.25 d | Topic-based FCM unsubscribe + PostHog dead-letter counter | Low |
| **PR-D** | N-3 | 0.25 d | Dedupe handleSecurityCommand via `applySecurityAction` helper | Low (refactor) |

**Total:** ~1.5 days focused. All P2 + N items shipped.

**Why this order:**
- PR-A first: mechanical, no schema, no l10n — easiest to review and approve.
- PR-B second: schema migration + l10n requires the i18n rule (en+hi both) and a Prisma migration. Slightly higher review burden.
- PR-C third: small Flutter + web changes, isolated.
- PR-D last: refactor with a refactor-only test. Cleanest to land.

**PR-A is the highest leverage** — it removes the last 3 `₹${...}.toFixed(2)` sites in the codebase, which is a long-standing review-time complaint.

---

## 6. Definition of done for the whole sequence

- [ ] PR-A merged: `grep "₹\${" web/src` returns 0 hits
- [ ] PR-B merged: `grep "globalThis.\$" web/src` returns 0 hits; `Rider.purgedAt` migration applied to production
- [ ] PR-C merged: PostHog shows `fcm_push_dead_lettered` events; the topic-unsub helper is in the push toggle handler
- [ ] PR-D merged: 1 switch statement (not 2); 12-action test passes
- [ ] Hindi ARB has all 4 new KYC keys (no English fallbacks)
- [ ] Web unit test count ≥ 3085 passing (no regressions)
- [ ] Flutter unit test count ≥ 1300 passing (no regressions)
- [ ] Linter clean (`npm run lint`, `flutter analyze --no-pub`)

**After this sequence: workflows audit is fully closed out.** The original 10-PR plan is shipped (T-90..T-99 + polish), the residual 7 P2s are shipped, and 3 new findings from today's re-audit are shipped. No remaining work in the workflows vertical.

---

## 7. Out of scope for this doc

- Front-end (covered by `docs/AUDIT_FLUTTER_2026-08-22.md` and `docs/AUDIT_FLUTTER_PAGES_2026-08-24.md`)
- Admin web panel (covered by `docs/AUDIT_ADMIN_2026-08-21.md`)
- Database schema (covered by `docs/AUDIT_DATABASE.md`)
- API surface (covered by `docs/AUDIT_API_DEEP.md`)
- Flutter rider pages (covered by `docs/AUDIT_FLUTTER_PAGES_2026-08-24.md`, T-110..T-119)
- The 5 changes I'd recommend from the public-apis search (OSM maps, Open Charge Map, Open-Meteo, Numverify, Mailboxlayer) — separate initiative, no audit ticket yet

---

## 8. Appendices

### 8.1 What the original audit said vs. what shipped

| Audit finding | Audit status | Actual status (2026-08-26) | PR |
|---|---|---|---|
| §1.1 Rent-reminder suppression + 100× bug | 🔴 P0 | ✅ SHIPPED | PR-1 (T-90) |
| §1.2 KYC INFO_REQUESTED silently dropped | 🔴 P0 | ✅ SHIPPED | PR-1 (T-91) |
| §2.1 Scheduled backup infinite loop | 🟠 P1 | ✅ SHIPPED | PR-2 (T-92) |
| §2.2 Referral reward integrity | 🟠 P1 | ✅ SHIPPED | PR-3 (T-93) |
| §2.3 GDPR purge field scope | 🟠 P1 | ✅ SHIPPED | PR-4 (T-94) |
| §2.4 KYC decision dedup + retry contract | 🟠 P1 | ✅ SHIPPED | PR-5 (T-95) |
| §2.5 Device-violation alert spam | 🟠 P1 | ✅ SHIPPED | PR-6 (T-96) |
| §2.6 Idempotency liveness | 🟠 P1 | ✅ SHIPPED | PR-7 (T-97) |
| §2.7 Reaper attempts increment | 🟠 P1 | ✅ SHIPPED (was already in place) | PR-8 (T-98) |
| §2.8 Announcements cron auth | 🟠 P1 | ✅ SHIPPED | PR-2 (T-92) |
| §2.9 Dead safety machinery | 🟠 P1 | ✅ SHIPPED | PR-7 (T-97) |
| §2.13 Workflow timeouts | 🟠 P1 | ✅ SHIPPED | PR-9 (T-99) |
| §2.14 Unpinned actions | 🟠 P1 | ✅ SHIPPED | PR-9 (T-99) |
| §3 polish (12 P2s) | 🟡 P2 | 5/12 SHIPPED, 7 REMAIN | PR-A, PR-B |
| §3 magic numbers + l10n (residual) | 🟡 P2 | 7 ITEMS REMAIN | PR-A, PR-B |

### 8.2 What I'd add to a future audit

If we re-audit workflows in 6 months, the new findings to add:
- **N-1: Topic-based FCM unsubscribe gap** (today's finding)
- **N-2: Dead-letter visibility on dispatcher** (today's finding)
- **N-3: handleSecurityCommand duplication** (today's finding)
- **N-4 (predicted): The post-purge backup retention window** — when a rider is purged, the historical transaction rows in the `transactions` table that reference the rider should NOT be deleted (audit requirement), but the `description` field carries the rider's name. New GDPR risk: `description` field scrub.
- **N-5 (predicted): The wallet ledger's `note` field** — same issue as `transaction.description`. PII in the ledger note.
- **N-6 (predicted): Idempotency on the admin endpoints** — the admin panel endpoints (`/api/admin/*`) don't all use `idempotencyKey` from the client. A double-click on "Approve KYC" could create two audit-log rows.

### 8.3 Why I'm being explicit about "already shipped"

Per the audit doc itself (§0): "The 2026-07-29 worker audit (`docs/AUDIT_WORKERS.md`, 66 KB, 10-PR plan) is still the canonical baseline — this document supersedes only the items called out as 'fixed in this re-audit'."

That phrasing is ambiguous — it could mean (a) "this 2026-08-23 audit is a snapshot, the PRs follow in subsequent sessions" or (b) "this audit is the snapshot, the PRs are the same session". The re-audit in §9.3 of the doc lists the previous session's already-shipped items. The `FOLLOWUP_TICKETS.md` "Shipped 2026-08-23" section makes it clear: all 10 PRs shipped the same day.

When a future audit is filed, I'd recommend adding a `## Status` section to the audit doc itself (not just `FOLLOWUP_TICKETS.md`), so it's unambiguous which findings are still open.
