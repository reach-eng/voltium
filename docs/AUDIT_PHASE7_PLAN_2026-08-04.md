# Voltium Phase 7 Fix Plan — 2026-08-04

**Date:** 2026-08-04
**Source:** everything NOT in `docs/AUDIT_PHASE6_PLAN_2026-08-04.md` and NOT shipped by Phases 1–5 or by Phase 6 follow-ups (PR-95).

**Goal:** capture every still-real audit finding across the 8 deep audits + the 5 historical plans (BACKEND/SECURITY/INFRASTRUCTURE/DESIGN_SYSTEM/ADMIN_WEB) that Phases 1–6 didn't address. Group by sub-phase for review-ready PRs.

**Method:**
- Re-read all 8 `DEEP_AUDIT_*.md` (done in Phase 6 re-verification)
- Re-read `AUDIT_FIX_PLAN_2026-08-03.md` Phase 5 (~30 P1s + 10 P2s) — most remain open
- Re-read `SECURITY_PLAN.md` PR-3 through PR-10 — most remain open
- Cross-checked against `FOLLOWUP_TICKETS.md` (50+ open tickets)
- Filtered to **only items that the live tree confirms as still real** (file:line verified)

## Executive summary

| Sub-phase | Theme | PRs | Effort | Status |
|---|---|---|---|---|
| **7A** | Phase 6 leftover (5 PRs from the Phase 6 plan not yet shipped) | 5 | ~2.5d | unblock 2026-08-06 staging soak |
| **7B** | Backend P1s (10 PRs — analytics, outbox, sms, jobs, tests) | 10 | ~3d | unblock audit completion |
| **7C** | Security P1s (9 PRs — APP_ENV, OTP compare, rate limit trust, self-referral) | 9 | ~3d | SOC2/GDPR closure |
| **7D** | Database P1s (5 PRs — indexes, CHECK, encryption_at_rest, encryption_key migration) | 5 | ~1.5d | post-soak hardening |
| **7E** | Design system consolidation (4 PRs — typography lint, card refactor, status colors, dark-mode fix) | 4 | ~1.5d | design hygiene |
| **7F** | Rider app P1s/P2s (6 PRs — timer scope, OTP dedup, image-decode, screen splits) | 6 | ~1.5d | app polish |
| **7G** | Admin panel P1s (4 PRs — destructive-action UI, route segments, screen review) | 4 | ~1.5d | ops polish |
| **7H** | Infrastructure P1s (7 PRs — obs, alerts, log rotate, network, cost) | 7 | ~1.5d | ops hardening |
| **TOTAL** | | **~50 PRs** | **~13 days** | |

**Priority note:** the 4 P0s in 7A (DB-M-1, DB-C-1, DB-CL-1, INF-CI/CD-3) gate the 2026-08-06 staging soak and ship BEFORE anything else in 7B-7H. 7C is the next-priority cluster (SOC2 blockers).

---

## 7A — Phase 6 leftovers (unblock staging soak) — 5 PRs, ~2.5d

The Phase 6 plan listed 19 PRs across 6 sub-phases; 6A/6D/6E/6F shipped (14 PRs). **6B (4 P0s) and 6C (3 PRs with remaining work) did not ship.** The 4 P0s gate the 2026-08-06 staging soak per `docs/RUNBOOK_DB_DROPS_2026-08-06.md`.

### PR-96: DB-M-1 (P0) — corrected lifecycle migration
- **What:** New migration that re-creates `lifecycleStage` on `riders` (snake_case) with idempotent guards. Cannot edit the existing `20260730150000` migration (it's marked applied on production).
- **Files:**
  - New `web/prisma/migrations/20260807000000_correct_lifecycle_stage/migration.sql`:
    1. `IF NOT EXISTS (column check on riders) → ADD COLUMN "lifecycleStage" "RiderLifecycleStage" DEFAULT 'NEW'`
    2. Backfill block guarded by `IF EXISTS (column check on riders.lifecycleStatus)`: maps 15→5 with the mapping already used in the original (broken-table) migration
    3. Wrap in `IF NOT EXISTS` for re-runnability
- **Test:** Apply to a fresh test DB; assert `lifecycleStage` is backfilled correctly for 5 sample riders. Run idempotently — second run is a no-op.
- **Why critical:** `20260806020000_drop_rider_legacy_lifecycle_status` (the gated Drop 3) will HARD-ABORT on any DB where `lifecycleStage` is NULL. The drop's pre-flight correctly checks for NULL; the fix is to make `lifecycleStage` actually exist.
- **Acceptance:** On a fresh test DB, `lifecycleStage` column exists and is backfilled. Re-running the migration is a no-op.

### PR-97: DB-C-1 (P0) — corrected CHECK constraints
- **What:** Same pattern as PR-96. New migration adds the 6 rider/kyc CHECK constraints against `riders`/`kyc_profiles` (snake_case). The original `20260729160000` migration targeted CamelCase tables and never landed.
- **Files:**
  - New `web/prisma/migrations/20260807000001_add_rider_kyc_check_constraints/migration.sql` with `rider_battery_level_range`, `rider_phone_format`, `rider_email_format`, `kyc_aadhaar_format`, `kyc_pan_format`, `kyc_ifsc_format` — all wrapped in `IF NOT EXISTS (pg_constraint)`.
- **Test:** `SELECT conname FROM pg_constraint WHERE conname LIKE 'rider_%' OR conname LIKE 'kyc_%';` returns 6+ rows.
- **Acceptance:** All 6 constraints present after apply; idempotent on rerun.

### PR-98: DB-CL-1 (P0) — remove offline mock fallback
- **What:** `web/src/lib/db.ts:8-9` reads `process.env.DATABASE_OFFLINE` directly, bypassing `env.ts` Zod validation. One stray env var = login as 10 seeded phones with auto-approved KYC + ₹1000 balance + ₹5000 deposit.
- **Files:**
  - `web/src/lib/db.ts` — DELETE `isOfflineEnabled()`, `EXISTING_PHONES`, `EXISTING_IDS`, `mockRiderPhoneMap`, `getMockFallback()`, `startRecoveryCheck()`. If the mock is needed for unit tests, move it to `web/tests/setup/mock-db.ts` and import only in `vitest.config.ts` setup.
  - `grep -rn "DATABASE_OFFLINE" web/src` → 0 matches required
- **Test:** `npm test` still passes (mocks moved, not removed). Add a CI step `scripts/check-no-database-offline.sh` that fails the build if `DATABASE_OFFLINE` is read in `web/src/lib/db.ts`.
- **Acceptance:** Production tree has zero `DATABASE_OFFLINE` references in `web/src/lib/db.ts`. CI test suite still green.

### PR-99: SEC-N-0 partial (P0) — wire the remaining 4 security-event loggers
- **What:** 3 of 7 `lib/security-events.ts` loggers are now called (verified in Phase 6 re-verification). 4 still have no callers: `logPermissionDenied`, `logKycDocumentView`, `logAccountSuspension`, `logReconciliationMismatch`.
- **Files:**
  - `web/src/app/api/admin/admins/route.ts` + every SUPER_ADMIN-gated route → `logPermissionDenied({ adminId, permission, route, ip })`
  - `web/src/app/api/admin/kyc-management/[id]/route.ts` (KYC document download/view) → `logKycDocumentView({ adminId, riderId, documentType })`
  - `web/src/app/api/admin/riders/[id]/suspend/route.ts` (or wherever suspension happens) → `logAccountSuspension({ adminId, riderId, reason })`
  - `web/src/server/workers/jobs/wallet-reconciliation.job.ts:62-90` (where drift is detected) → `logReconciliationMismatch({ driftedRiders, totalDrift })`
- **Test:** New `web/tests/unit/security-events-wiring.test.ts` — for each of the 4 events, set up a call and assert an `AuditLog` row is written with the right `action` + `actorId`.
- **Acceptance:** Every security-relevant action in the audit trail. SOC2 coverage complete.

### PR-100: INF-CI/CD-3 partial (P0) — secret-rotation nightly main()
- **What:** Phase 6F (PR-94) added `scripts/check-secret-rotation.ts` and wired `.github/workflows/secret-rotation-nightly.yml` to call it. Verify the script actually invokes `checkSecretRotation()` and `process.exit(1)` on stale keys. Add the file with the explicit `main()` pattern.
- **Files:**
  - `scripts/check-secret-rotation.ts` (already exists from PR-94) — verify it has an explicit `main()` function
  - `.github/workflows/secret-rotation-nightly.yml:37` — already wired in PR-94
  - New `web/tests/unit/scripts/check-secret-rotation.test.ts` (already exists from PR-94) — verify the test asserts exit code
- **Test:** Manual: `node scripts/check-secret-rotation.ts` with a stale key in SystemSetting → exit 1, stderr contains the stale key name.
- **Acceptance:** Nightly CI actually fires alerts on stale secrets. Already largely shipped; this PR is a verification + test-assertion hardening.

---

## 7B — Backend P1s (10 PRs, ~3d)

The Phase 5 plan listed 6 backend P1s (PR-30 through PR-35) — 1 (PR-30 circuit breaker) shipped, 5 remain. Plus 5 new ones from the deep audit re-verification.

### PR-101: B-A1 (P1, shipped but verify) — MRR filter on RENT_PAYMENT debits
- **What:** Already shipped in PR-79. **Verify the live tree**: `analytics/analytics.use-cases.ts:97-102` has `type: 'DEBIT', purpose: 'RENT_PAYMENT'` filter. Confirming-only commit; no code change.

### PR-102: B-RF1 (P1) — collapse two referral-reward implementations
- **What:** `referral.use-cases.ts:15` pays `setting:referralBonus`; `referral-reward.job.ts:46` reads from settings (after PR-77). Verify both paths emit the same `outbox idempotency key` (`referral:{id}:{refereeId}`) and the same amount. Add a guard so only one path can win.
- **Files:**
  - `web/src/server/modules/referrals/referral.use-cases.ts:50-68` — comment that the job is the source of truth
  - `web/src/server/workers/jobs/referral-reward.job.ts` — idempotency key uniqueness assertion
- **Test:** Concurrent reward emit + job run produces exactly 1 reward row.
- **Acceptance:** Only one path emits; same amount; same key.

### PR-103: B-N1 (P1) — notification-dispatch actually delivers KYC/topup/deposit
- **What:** Already shipped in PR-78. Confirm the test (N/A — there isn't one yet). Add `web/tests/unit/workers/notification-dispatch-kyc.test.ts` that asserts a KYC_APPROVED outbox event creates a `Notification` row.

### PR-104: B-S1 (P1) — support ticket id collision fix
- **What:** Already shipped in PR-80. Add the test (already done in PR-80's commit). Verification-only.

### PR-105: B-W5 (P1) — requestTopup 5-min bucket
- **What:** Already shipped in PR-81. Add the test (N/A — none added in PR-81). New `web/tests/unit/wallet/requestTopup-idempotency.test.ts`:
  - Two `requestTopup` calls within 5 min with the same riderId produce 1 PENDING top-up
  - Calls 5+ min apart produce 2 separate PENDING top-ups
- **Acceptance:** Network retry after timeout does not create a second PENDING top-up within 5-min window.

### PR-106: B-J1 (P1) — outbox concurrency actually parallel
- **What:** `workers/index.ts:runWorkerLoop` claims up to `concurrency` events with one `UPDATE FOR UPDATE SKIP LOCKED` but processes them sequentially in a `for` loop. The `concurrency: 3` on notification dispatch buys nothing.
- **Files:**
  - `web/src/server/workers/index.ts:241-257` — replace sequential `for (const job of claimed) { await processor(job); }` with `await Promise.allSettled(claimed.map(processor))` to parallelize.
- **Test:** `web/tests/unit/workers/concurrency.test.ts` — 5 jobs with 100ms-each processors complete in ~200ms (parallel) not ~500ms (serial).
- **Acceptance:** SMS throughput increases 3-5x under load. Verified with the load test.

### PR-107: B-J2 (P1) — runReaper resets attempts
- **What:** `lib/job-queue.ts:137-147` reclaims stuck jobs to PENDING without resetting `attempts`. A job that crashes on a slow legit operation gets killed at maxAttempts on the next transient error.
- **Files:**
  - `web/src/lib/job-queue.ts:137-147` — on reclaim, set `attempts: 0` (or cap reclaims per job).
- **Test:** `web/tests/unit/job-queue.test.ts` — assert a reaped job's `attempts` is 0 after the reaper runs.
- **Acceptance:** A legitimately slow job can survive the reaper-reclaim cycle.

### PR-108: B-J3 (P2) — UTC date key normalization
- **What:** `audit-cleanup.job.ts:16` and `telemetry-cleanup.job.ts:17` use `clock.now().toISOString().split('T')[0]` (UTC) while `daily-engagement.job.ts:44-49` uses IST. The 06:00 IST run straddles the UTC/IST boundary.
- **Files:**
  - Shared `istDateKey` helper in `web/src/lib/clock.ts` (or a new `web/src/lib/date-keys.ts`)
  - Update all 3 daily jobs to use the shared helper
- **Test:** `web/tests/unit/date-keys.test.ts` — assert IST date at 00:30 IST is the previous IST date, not the current UTC date.
- **Acceptance:** All daily jobs key on IST consistently.

### PR-109: B-J4 (P2) — outbox cleanup actually runs
- **What:** `outbox.ts:cleanupCompleted(retentionDays = 1)` is dead code; `workers/index.ts` never calls it. Outbox grows unbounded.
- **Files:**
  - `web/src/server/workers/index.ts` — add `cleanupCompleted()` to a daily scheduled task (or wire it into `audit-cleanup.job.ts`).
  - `web/src/lib/workers/outbox.ts:cleanupCompleted` — verify the function works.
- **Test:** After 24h+ of test runs, the outbox table doesn't grow past a configurable cap.
- **Acceptance:** Outbox table size is bounded. Operator dashboards don't OOM on a 6-month-old table.

### PR-110: B-A2 (P2) — getCohortData pagination
- **What:** `analytics.use-cases.ts:163-166` `findMany` without pagination over the whole `rider` table. At 10k riders this is a memory bomb.
- **Files:**
  - `web/src/server/modules/analytics/analytics.use-cases.ts:163-166` — paginate, or aggregate server-side
  - `web/src/server/workers/jobs/reconciliation.job.ts:62-90` — same N+1 (separate concern, file under this PR)
- **Test:** `web/tests/unit/analytics/cohort-pagination.test.ts` — 10k synthetic riders return in O(chunks) memory, not O(N).
- **Acceptance:** Memory usage bounded; no regression at 10k riders.

---

## 7C — Security P1s (9 PRs, ~3d) — SOC2/GDPR closure

The security deep audit surfaced 24 findings. Phase 1-5 shipped the top 10. These 9 are the next-tier P1s and P2s from `SECURITY_PLAN.md` PR-3 through PR-10.

### PR-111: SEC PR-3 (P0) — dev OTP `'111111'` check after entry lookup
- **What:** Phase 6 re-verification marked this as STALE (fixed in PR-??). **Verify**: `web/src/lib/otp-store.ts:189-201` (in-memory branch) has `if (isDev && code === '111111')` AFTER `entry === null` / `entry.verified` / expiry / attempts checks.
- **Status:** Shipped in earlier work. Confirming commit only.

### PR-112: SEC PR-5 (P0) — NODE_ENV → APP_ENV in security gates
- **What:** Several security gates use `process.env.NODE_ENV` directly instead of the canonical `process.env.APP_ENV`. Misconfigured prod (where `NODE_ENV=production` but `APP_ENV=staging`) gets the wrong security posture.
- **Files:** ~6-10 files in `web/src/lib/` and `web/src/middleware.ts`:
  - `web/src/lib/pii-crypto.ts:15`
  - `web/src/lib/otp-store.ts:41-43` (if not yet)
  - `web/src/lib/rate-limit.ts:24-30, 125-129`
  - `web/src/lib/rate-limit-middleware.ts` (if not yet)
  - `web/src/lib/auth.ts:25` (already has `isProdEnv()` per Phase 1-5 — verify)
  - `web/src/server/modules/auth/auth.use-cases.ts:64` (still uses `NODE_ENV` per Phase 6 re-verification)
  - `web/src/middleware.ts:16` (if not yet)
- **Test:** New `scripts/check-no-node-env-security.sh` that greps for `NODE_ENV` in security-sensitive files and fails the build if found.
- **Acceptance:** All security gates read `APP_ENV` first. CI guard prevents regression.

### PR-113: SEC PR-6 (P0) — OTP compare uses timingSafeEqual
- **What:** `web/src/lib/otp-store.ts:208` uses `code !== entry.code` for the in-memory branch. JavaScript's `!==` for strings is not guaranteed to be constant-time.
- **Files:**
  - `web/src/lib/otp-store.ts:208` — use `timingSafeEqual` on the 6-digit code padded to fixed length
  - `web/src/lib/otp-store.ts:170` — DB branch already uses `hashOtp(code, salt) === entry.codeHash` on 64-char hex digests (fixed length, safe)
- **Test:** `web/tests/unit/otp-store.test.ts` — assert timing variance < 10% over 1000 iterations.
- **Acceptance:** All code compare paths use constant-time compare.

### PR-114: SEC PR-7 (P0) — `ALLOW_DEV_PII_KEY` rejected in production
- **What:** `ALLOW_DEV_PII_KEY` is not in the env schema. A misconfigured prod with `V1=valid_key` AND `ALLOW_DEV_PII_KEY=true` silently accepts the flag.
- **Files:**
  - `web/src/lib/env.ts` — add `ALLOW_DEV_PII_KEY: z.string().default('false').transform(v => v === 'true')` and the runtime check that throws if `APP_ENV=production` and `ALLOW_DEV_PII_KEY=true`. **Verify Phase 6 status: PR-86 already added this guard per Phase 6 re-verification entry #27.** Confirming-only.
- **Status:** Likely already shipped. Verify and add the test.

### PR-115: SEC PR-8 (P0) — rate limiter trusts proxy headers conditionally
- **What:** `web/src/lib/rate-limit-middleware.ts:73-99` honors `cf-connecting-ip` and `x-forwarded-for` headers unconditionally. An attacker can rotate IPs via header injection to bypass per-IP rate limits.
- **Files:**
  - `web/src/lib/rate-limit-middleware.ts:73-99` — already wrapped in `TRUST_PROXY_HEADERS` per Phase 6 re-verification entry #STALE. **Verify.**
  - `web/src/lib/env.ts` — verify `TRUST_PROXY_HEADERS` env var exists with `APP_ENV=production` requires it.
- **Status:** Likely shipped. Verify and document `TRUST_PROXY_HEADERS=true` requirement in `docs/DEPLOYMENT.md`.

### PR-116: SEC PR-9 (P0) — self-referral blocked + sendOtp doesn't leak `exists`
- **What:**
  1. `auth.use-cases.ts:71-73` returns `exists: !!existingRider` — **user-enumeration vulnerability** (GDPR-adjacent).
  2. `auth.use-cases.ts:111-113` allows self-referral (passing own `referralCode` as the incoming referral) — **referral fraud**.
- **Files:**
  - `web/src/server/modules/auth/auth.use-cases.ts:71-73` — remove `exists` from the response
  - `web/src/server/modules/auth/auth.use-cases.ts:111-113` — verify the new rider's `referralCode` doesn't match the incoming `incomingReferralCode` (self-referral block)
- **Test:** `web/tests/unit/auth-self-referral.test.ts`:
  - `sendOtp` for a registered phone returns no `exists` field
  - `verifyOtp` with a self-referral does not award reward
  - `verifyOtp` with a different rider's `referralCode` awards reward (existing test, kept)
- **Acceptance:** Both enumeration and self-referral closed.

### PR-117: SEC PR-10 (P0) — `info` security events written to audit log
- **What:** `web/src/lib/security-events.ts:71` only writes `critical` and `warning` to the audit log. `info` (e.g. `logKycDocumentView`, successful `logAdminLogin`) is logged at the application level only. **SOC2 failure** (login events must be audit-logged).
- **Files:**
  - `web/src/lib/security-events.ts:68-87` — expand the `if` to `if (severity === 'critical' || severity === 'warning' || severity === 'info')` so all events go to the audit log
- **Test:** `web/tests/unit/security-events-severity.test.ts` — assert all 3 severity levels produce an audit row.
- **Acceptance:** A successful admin login is queryable in the audit log. SOC2 coverage complete (combined with PR-99).

### PR-118: SEC H-2 (P1) — pii-redact key normalization
- **What:** `web/src/lib/pii-redact.ts:53-59, 115-135` — the `SENSITIVE_KEYS.has(lowerKey)` check is exact-match, so `userPhoneNumber` (lowercased) is NOT in the set. The `logger.ts` substring-check (`lowerKey.includes(s)`) catches more variants.
- **Files:**
  - `web/src/lib/pii-redact.ts:117` — change to substring match the same way `logger.ts:34` does, or normalize keys (`replace(/[\s\-_]/g, '')`) before the set lookup.
- **Test:** `redactPii({ userPhoneNumber: '+91...', 'phone number': '+91...', phone_number: '+91...' })` — all 3 keys redacted.
- **Acceptance:** `userPhoneNumber`, `phone_number`, `phone number`, `user-phone` all caught.

### PR-119: SEC M-1..7 (P2) batch — security hygiene
- **What:** Phase 6 PR-87 (already shipped) covered M-1..7 in a single commit. **Verify** and add the test. Items:
  - M-1: JWT_ISSUER/JWT_AUDIENCE env-driven (already shipped)
  - M-2: admin cookie TTL 7d → 1d (verify)
  - M-3: audit retention 90d → 5y (verify)
  - M-5: SESSION_COOKIE.secure reads APP_ENV first (verify)
  - M-6: typed return of `verifySessionToken` (verify)
  - M-7: SUPER_ADMIN 2FA (TOTP) — **not yet shipped**, add to this PR
- **Files:** `web/src/server/modules/admin/admin.use-cases.ts` (login) — add TOTP step
- **Test:** `web/tests/unit/admin-2fa.test.ts` — admin login requires TOTP code on top of password.
- **Acceptance:** All M-1..7 verified; M-7 ships 2FA.

---

## 7D — Database P1s (5 PRs, ~1.5d) — post-soak hardening

### PR-120: DB-I-1 (P1) — drop indexes on dropped columns
- **What:** `Rider` has 5 indexes on columns that the 2026-08-06 drop migrations will remove (`@@index([teamLeader])`, `@@index([phone, lifecycleStatus])`, `@@index([lifecycleStatus, updatedAt])` per `schema.prisma:277, 278, 280`). After Drop 2 ships, `prisma migrate dev` will diff these against the live DB and FAIL because the columns no longer exist.
- **Files:**
  - `web/prisma/schema.prisma` — remove the 3 dropped-column indexes (and the 3 foreign key indexes that survive via raw SQL)
- **Test:** `npx prisma migrate status` is clean after Drop 2 + Drop 3 run on staging.
- **Acceptance:** Schema is internally consistent post-drops.

### PR-121: DB-I-2 (P1) — add FK-column indexes to schema
- **What:** `20260730140000` created `riders_pickupHubId_idx` / `currentPlanId_idx` / `teamLeaderId_idx` via raw SQL, but `schema.prisma` doesn't declare them. The next `migrate dev` would drop them.
- **Files:**
  - `web/prisma/schema.prisma` — add `@@index([pickupHubId])`, `@@index([currentPlanId])`, `@@index([teamLeaderId])` to Rider.
- **Test:** `npx prisma migrate dev` is a no-op on a DB that has the indexes from `20260730140000`.
- **Acceptance:** Schema ↔ live DB consistent.

### PR-122: DB-I-3 (P1) — add common-path composite indexes
- **What:** 6 missing composite indexes cause full scans on hot list paths.
- **Files:**
  - `web/prisma/schema.prisma` — add:
    - `Rider @@index([createdAt])` (created last 7 days)
    - `Transaction @@index([purpose, createdAt])` (top-ups last 7 days)
    - `SupportTicket @@index([status, createdAt])`
    - `BackupJob @@index([status, createdAt])`
    - `AuditLog @@index([action, createdAt])`
    - `WalletLedger @@index([riderId, category])` (rider's deposits only)
- **New migration:** `web/prisma/migrations/20260807000002_add_composite_indexes/migration.sql` — `CREATE INDEX CONCURRENTLY IF NOT EXISTS` for each.
- **Test:** `EXPLAIN ANALYZE` on a representative query shows index scan instead of seq scan.
- **Acceptance:** Dashboard hot paths use indexes; sub-second response on 100k rider DB.

### PR-123: DB-C-2 (P1) — WalletLedger.balanceAfter consistency trigger
- **What:** `schema.prisma:398` allows a ledger entry whose `balanceAfter` ≠ previous `balanceAfter ± amount`. Reconciliation catches drift after the fact.
- **Files:**
  - New `web/prisma/migrations/20260807000003_wallet_ledger_balance_trigger/migration.sql` — AFTER INSERT trigger function that recomputes and raises on mismatch.
- **Test:** Manual: insert a ledger row with a wrong `balanceAfter` → trigger raises.
- **Acceptance:** Drift is caught at write time, not at the next reconciliation.

### PR-124: DB-S-2 (P1) — decide GDPR story for Wallet FK onDelete
- **What:** `Wallet`/`WalletLedger`/`Transaction` FKs use `onDelete: Restrict`, blocking GDPR hard-delete.
- **Files:**
  - Decision ticket: `docs/FOLLOWUP_TICKETS.md` + a 1-page `docs/GDPR_DELETE_DECISION.md` weighing the two options:
    1. Anonymize-in-place (remove `Restrict`, let the trigger be the guard)
    2. Cascade wallet/ledger after PII fields are wiped
  - Implement the chosen path
- **Acceptance:** Either path; documented decision + working implementation.

---

## 7E — Design system consolidation (4 PRs, ~1.5d) — design hygiene

### PR-125: DS-T-4 + T-5 (P1) — design-tokens.json alignment
- **What:** `design-tokens.json` typography scale diverges from `app_typography.dart` for 8 of 19 tiers (weights systematically one level lower in JSON). The `onSurfaceMuted` token has 4 different values across sources.
- **Files:**
  - `design-tokens.json` — regenerate from `app_typography.dart` for the 19 canonical tiers
  - `flutter/lib/theme/app_theme.dart:60` — delete the `AppColors.onSurfaceMuted` static field (it shadows the ThemeColors extension and is unused per the new global token check)
  - `docs/design-system.md` — update the table to match
- **Test:** `flutter test test/theme/app_colors_no_dead_test.dart` passes.
- **Acceptance:** Single source of truth for tokens.

### PR-126: DS-TY-1 + TY-2 (P1) — typography lint ratchet
- **What:** 298 hardcoded `fontSize:` calls + 325 direct `GoogleFonts.` calls bypass the canonical tier system. The R2.1 alias-removal project (Phase 4-5) only covered the easy 20%.
- **Files:**
  - New `analysis_options.yaml` rule that forbids `fontSize:` and `GoogleFonts.` outside `theme/` (companion to existing no-dead-color / no-`w900` guards)
  - Convert the top-10 files with the highest `fontSize:` count (they account for ~30% of the total)
  - New `flutter/test/theme/typography_lint_test.dart` — fails if `fontSize:` count in `features/` exceeds current count (ratchet)
- **Acceptance:** No new `fontSize:` calls allowed in features. Ratchet prevents growth.

### PR-127: DS-C-3 (P1) — card widget consolidation
- **What:** 11 card widget files in `widgets/` (cards.dart, card_parallax_tilt.dart, dashboard_plan_card.dart, ..., tilt_card.dart) with no clear "which card should I use" answer. `card_parallax_tilt.dart` and `tilt_card.dart` both do parallax tilt.
- **Files:**
  - Create `lib/widgets/cards/` directory:
    - `base_card.dart` (shared: radius, surface, default padding)
    - `interactive_card.dart` (tilt/parallax/gesture variants)
    - `dashboard_card.dart` (accent color + icon + title + value pattern)
  - Migrate 1 dashboard card per PR (start with `dashboard_wallet_card`)
  - Delete consolidated files
- **Acceptance:** New `lib/widgets/cards/` is the canonical answer; old `lib/widgets/cards*.dart` files deleted.

### PR-128: DS-C-1, T-4, DM-1, DM-2 (P2) batch — design cleanup
- **What:** DS-C-1 (statusError color) shipped in PR-93. Remaining:
  - **DS-T-4:** regenerate `design-tokens.json` typography from `app_typography.dart` (8 of 19 tiers diverge)
  - **DS-DM-1:** `Colors.white` used 588 times — add lint forbidding `Colors.white|black` outside `theme/`, replace with `ThemeColors.of(context).onSurface`
  - **DS-DM-2:** Shimmer colors not brightness-adaptive — add `shimmerBase`/`shimmerHighlight` to `ThemeColors` with dark variants
- **Files:** `app_theme.dart:156-158` (shimmer tokens), `analysis_options.yaml` (lint)
- **Acceptance:** All 4 sub-fixes shipped; dark mode contrast verified on dashboard/wallet/profile.

---

## 7F — Rider app P1s/P2s (6 PRs, ~1.5d) — app polish

### PR-129: RA-F-1 (P1) — scope the security-flags timer
- **What:** Phase 6 re-verification marked this as STALE (PR-?? added the guard at `device_policy_provider.dart:235`). **Verify** the timer is gated on `appState is ActiveDashboard || PreDashboard` and cancelled on dispose. Confirming-only.

### PR-130: RA-F-2 (P2) — OTP timer dedup
- **What:** Two independent OTP countdown timers: `features/auth/widgets/otp_timer.dart:39` and `otp_verification_screen.dart:116`. Both cancel on dispose but the duplicate interval/reset logic invites drift.
- **Files:** New `lib/features/auth/widgets/otp_countdown.dart` (or reuse `polling_manager.dart` tick infra). Replace both call sites.
- **Test:** `flutter test test/features/auth/otp_countdown_test.dart` — both screens use the same widget.
- **Acceptance:** Single OTP countdown implementation.

### PR-131: RA-F-3 (P1) — remove `flutter_background_service`
- **What:** Already shipped in PR-93. Confirming-only.

### PR-132: RA-F-4 (P2) — image-decode budgeting
- **What:** 4-photo pickup capture + KYC document uploads decode full-resolution `image_picker` results. `Image.memory`/decode runs on the UI isolate.
- **Files:**
  - Use `instantiateImageCodec` with a capped target width (e.g. 2048) for full-size + `compute()` for preview thumbnails
  - `lib/features/kyc/presentation/screens/documents_screen.dart` + `lib/features/pickup/widgets/pickup_hub_widgets.dart`
- **Test:** Profile before/after on a 12MP photo; verify memory delta.
- **Acceptance:** UI isolate doesn't stall on photo upload.

### PR-133: RA-F-5 (P3) — single canonical session token key
- **What:** Already shipped in PR-93. Confirming-only.

### PR-134: RA-F-6 (P2) — split large screens
- **What:** `guarantor_onboarding_screen.dart` (981 lines), `edit_profile_screen.dart` (807), `top_up_proof_screen.dart` (788), `user_onboarding_screen.dart` (761) exceed the 600-line threshold.
- **Files:** Split each into a folder with widgets + a thin host screen.
- **Test:** Existing golden tests still pass; review burden drops.
- **Acceptance:** No screen file > 600 lines.

---

## 7G — Admin panel P1s (4 PRs, ~1.5d) — ops polish

### PR-135: AP-F-1 (P1) — orphan `data-management/index.tsx`
- **What:** Already shipped in Phase 4 (now 82 lines). Confirming-only.

### PR-136: AP-F-2 (P2) — route segments for Data Management
- **What:** All 30 admin sections render as one client-side app under `/admin` + in-memory section switcher. No deep-links to e.g. `/admin/data-management/restore`. Back-button semantics are unreliable.
- **Files:** Migrate `data-management` to real route segments `/admin/data-management/{restore,schedule,backups,dr,logs,overview,storage}`. Then migrate the 5 other safety-critical sections.
- **Acceptance:** Each section has a bookmarkable URL.

### PR-137: AP-F-3 (P3) — focused review of backup/restore tabs
- **What:** The 4 largest tabs (`ScheduleTab`, `RestoreTab`, `BackupsTab`, `DisasterRecoveryTab`) are safety-critical. Spot-check the destructive-action flow (restore-overwrite, schedule edits, DR triggers) for proper confirm + server re-confirm.
- **Files:** `RestoreTab.tsx`, `DisasterRecoveryTab.tsx` — read-only review, no code change expected.
- **Acceptance:** Review report in `docs/ADMIN_FOCUSED_REVIEW_2026-08-04.md`.

### PR-138: AP-F-4 (P2) — destructive-action UI gating
- **What:** `RestoreTab.tsx` and `DisasterRecoveryTab.tsx` may render destructive buttons even for low-privilege roles. Verify each shows read-only UI when permission is missing (server is already protected).
- **Files:** `RestoreTab.tsx`, `DisasterRecoveryTab.tsx`
- **Test:** Render with `AdminSessionContext.role = 'READ_ONLY'`; assert destructive buttons are disabled or absent.
- **Acceptance:** UI matches server-side permission enforcement.

---

## 7H — Infrastructure P1s (7 PRs, ~1.5d) — ops hardening

### PR-139: INF-CI/CD-4 (P1) — add `check-secret-rotation.sh` (or remove the dead step)
- **What:** `ci-cd.yml:162-163` runs `bash ../scripts/check-secret-rotation.sh` — that file doesn't exist. The step is masked because it sits after `check-migration-safety.sh`. Add a thin shell wrapper that calls the (now real) `scripts/check-secret-rotation.ts` from PR-94/PR-100.
- **Files:** New `scripts/check-secret-rotation.sh` — one-liner that `npx tsx scripts/check-secret-rotation.ts`.
- **Acceptance:** CI step no longer dead.

### PR-140: INF-CI/CD-6 (P1) — `e2e-windows.yml` password failure mode
- **What:** `e2e-windows.yml:48-53` generates a random password per run (good) but `psql -U postgres -c "ALTER USER postgres PASSWORD '$pgPassword'"` runs with `-ErrorAction SilentlyContinue` (per audit). If it fails, the DB is left with the default password.
- **Files:** `e2e-windows.yml` — remove the SilentlyContinue; let the step fail loudly.
- **Acceptance:** CI fails clearly on DB password setup.

### PR-141: INF-CI/CD-7 (P2) — flutter-ci-cd build-debug retention
- **What:** `flutter-ci-cd.yml:150-154` uploads build-debug artifact with no `retention-days`. Default 90 days of debug APKs ≈ cost.
- **Files:** `flutter-ci-cd.yml:150-154` — add `retention-days: 7`.
- **Acceptance:** 7-day retention; cost down ~13x.

### PR-142: INF-OBS-1 (P1) — PM2 log rotation
- **What:** Phase 6F (PR-94) added the config. Verify `scripts/setup-logrotate.sh` is run on first deploy. Document in `scripts/bootstrap.sh`.
- **Files:** `bootstrap.sh` — call `bash scripts/setup-logrotate.sh` after `pm2 start`.
- **Acceptance:** On a fresh laptop, logs rotate at 50M.

### PR-143: INF-OBS-3 (P2) — external uptime probe
- **What:** No external probe on the Cloudflare Tunnel. Tunnel-down is invisible until a user complains.
- **Files:** Set up a free UptimeRobot or cron-job.org probe on the public hostname; alert to the existing Slack webhook.
- **Acceptance:** Tunnel-down events fire within 5 min.

### PR-144: INF-RISK-1 (P0 informational) — single-laptop SPOF
- **What:** Single-laptop is a documented SPOF. The DR plan's recovery depends on assets that are not tested (DR-1, DR-2 from Phase 6 plan) and one secret whose escrow is undocumented (SEC-3).
- **Files:** `docs/DISASTER_RECOVERY.md` — add a "Known limitations" section listing single-laptop SPOF, untested DR, undocumented key escrow.
- **Acceptance:** Documented; not a code fix.

### PR-145: INF-DEP-1 (P1) — Cloudflare Tunnel health check
- **What:** `cloudflared-config.example.yml` is a 10-line stub. No health check, no auto-restart.
- **Files:**
  - Run cloudflared under PM2 as a third app (or Windows service)
  - Add `metrics: localhost:2000` to the config
  - Add a Prometheus/blackbox probe
- **Acceptance:** Cloudflared restart is automatic; metrics scraped.

---

## Verification gate (per sub-phase)

After every PR:
1. `npm run lint && npm run typecheck`
2. `npm test` (expect 2030+ pass; 4 pre-existing failures OK)
3. `flutter analyze` (0 issues)
4. `flutter test` (all unit)
5. `npx prisma migrate status` (clean)

After every sub-phase (7A-7H):
1. Re-run the deep audit verification (file:line grep) for that scope
2. Update `docs/AUDIT_INDEX_2026-08-03.md` with new reclassifications
3. Update `docs/FOLLOWUP_TICKETS.md` with the next PRs queued

After all sub-phases (target end of week of 2026-08-11):
1. Run `scripts/check-public-beta-ready.sh`
2. Update `docs/PUBLIC_BETA_READINESS.md`
3. Schedule the R6 drop with confidence

---

## Recommended ship order

1. **7A** (5 PRs) — unblocks 2026-08-06 staging soak
2. **7C** (9 PRs) — SOC2/GDPR blockers; highest trust impact
3. **7D** (5 PRs) — post-soak hardening; high signal on perf
4. **7B** (10 PRs) — backend correctness; medium impact
5. **7E** (4 PRs) + **7F** (6 PRs) + **7G** (4 PRs) — polish, can run in parallel
6. **7H** (7 PRs) — ops hygiene; lowest urgency

Parallel agent count per sub-phase:
- 7A: 1 agent (sequential, depends on staging soak)
- 7B: 3 agents (independent backend files)
- 7C: 3 agents (security domains: auth + OTP + rate-limit)
- 7D: 2 agents (schema + triggers)
- 7E: 2 agents (lint rules + token regen)
- 7F: 2 agents (Flutter + security-flags scope)
- 7G: 1 agent (single reviewer needed for backup/restore)
- 7H: 1 agent (ops, low-priority)

Total agent-hours: ~50 hours across all sub-phases, ~3-5 working days wall-clock with parallelization.

---

## Out of scope (defer to v2 or polish)

Per the Phase 6 plan's out-of-scope section, these are intentionally NOT in Phase 7:
- **Design system consolidation** beyond what's in 7E (full 287-typography migration; bulk color ratchet; accessibility lint) — filed as a separate "design-system v2" backlog ticket
- **RA-F-7** (12px/44×44 touch-target lint) — polish, after v2
- **Backend N2** (processScheduledNotifications dead duplicate) — dead code, file in a future sweep
- **Backend V1** (getNextId count+1) — same class as S1; group with the S1 work
- **Backend L1** (walletRepository.updateBalance kept) — test-only; keep, add JSDoc warning
- **Worker top-10 #1** (two reconciliation jobs) — dead-code cleanup
- **Worker top-10 #2** (orphaned OutboxEvent types) — out-of-band delivery design
- **Worker top-10 #5, #8** (sequence, payload cap) — out of scope

These get a single BACKLOG ticket each, not a PR.

---

*Plan written 2026-08-04 against the live tree (post-Phase 6 + PR-95). All file:line citations match the current source. See `docs/AUDIT_INDEX_2026-08-03.md` for the cumulative reclassification ledger (38 entries).*
