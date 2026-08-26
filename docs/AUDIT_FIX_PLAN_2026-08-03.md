# Voltium — Phased Fix Plan (2026-08-03)

**Date:** 2026-08-03
**Source:** the 8 deep audits (`docs/AUDIT_*_2026-08-03.md` + `docs/AUDIT_INDEX_2026-08-03.md`).
**Goal:** ship every P0 in review-ready PRs, grouped into 5 phases that minimize risk, respect the 2026-08-06 staging soak gate, and unblock R6 (Rider app drop phase).

---

## Executive Summary

| Phase | Theme | PRs | LOC | Calendar | Why this phase |
|---|---|---|---|---|---|
| **Phase 1** | **Stop the bleeding** (security/privacy/RBAC) | 8 PRs | ~150 | **2 days** | Fixes 4 P0s that have been live for 1+ month. **Highest urgency.** |
| **Phase 2** | **Visible-to-user fixes** (brand, upload, audit gaps) | 7 PRs | ~200 | **3 days** | Brand drift + photo upload blocking + missing audit logs. Visible in production. |
| **Phase 3** | **Performance & scale** (DB, queue, infrastructure) | 8 PRs | ~150 | **2-3 days** | Lint debt, memory leak, queue starvation, statement timeout. Pre-staging-soak. |
| **Phase 4** | **Architecture refactors** (multi-file P0s) | 5 PRs | ~700 | **1-2 weeks** | Chokepoint, validator wiring, heading component, APK split, button migration. Bigger blast radius. |
| **Phase 5** | **P1s and P2s** (housekeeping) | ~15 PRs | ~500 | **1-2 weeks** | P1s surfaced in the audits. Polish, test coverage, observability. |
| **TOTAL** | | **~43 PRs** | **~1700 LOC** | **5-6 weeks** | |

**Constraint:** R6 (Rider app drop phase) is gated on the **2026-08-06 staging soak** per `docs/RUNBOOK_DB_DROPS_2026-08-06.md`. Phase 1 must ship before that soak (it touches PII destruction). Phase 2-3 can ship during the soak. Phase 4-5 after.

---

## Dependency Graph (read this before picking a PR)

```
                  PR-71 (align schema with 2026-08-06)
                                |
                  PR-72 (verify cache_indexes_v2 SQL)
                                |
              +-----------------+-----------------+
              |                                   |
        PR-55 (session.role fix)            PR-56 (x-admin-id)
              |                                   |
        PR-58 (admin/jobs permission)         PR-64 (incident audit)
              |                                   |
        PR-59 (brand primary)               PR-66 + PR-67 (photo upload)
              |
        PR-57 (data-deletion audit + crypto)
              |
              v
    ALL OTHER PRs CAN SHIP IN PARALLEL
```

**Critical-path PRs (must ship first):**
- **PR-71** blocks every other DB-touching PR (it removes legacy columns; other migrations assume the new schema).
- **PR-72** blocks every PR that adds an `@@index` (it verifies the SQL matches the schema).
- **PR-55** unblocks testing the maintenance-mode + system-settings features end-to-end.

**No-dependency PRs (can ship in any order):**
- PR-58, PR-59, PR-60, PR-61, PR-62, PR-63, PR-64, PR-65, PR-68, PR-69, PR-73, PR-74, PR-75.

---

# Phase 1 — Stop the bleeding

**Theme:** security/privacy/RBAC P0s that have been live for 1+ month. **Highest urgency.** Must ship before the 2026-08-06 staging soak.

**8 PRs, ~150 LOC, 2 days.**

## PR-71 — Align `schema.prisma` with 2026-08-06 migrations

**Audit:** Database N1
**File:** `web/prisma/schema.prisma`, `web/prisma/migrations/2026080600*`
**Risk:** HIGH — drops 3 columns; affects every read/write to `Rider` and `Admin`.

### Why first
The 2026-08-06 staging soak depends on this. The migrations exist on disk; the schema is out of sync. A new developer running `prisma migrate dev` will see drift warnings, and a `prisma db push` will silently no-op.

### Steps
1. Locally run `npx prisma migrate dev` to apply the 3 2026-08-06 migrations to the dev DB.
2. Open `web/prisma/schema.prisma`. Remove:
   - `Rider.lifecycleStatus` (replaced by `riderLifecycleStage`).
   - `Rider.aadhaarNumber`, `Rider.panNumber`, `Rider.guarantorPhone` (moved to `KycProfile` / `Guarantor`).
   - `Admin.hasPermission` (moved to `AdminHasPermission` join table).
3. Run `npx prisma generate`. Verify `npx prisma migrate status` is clean.
4. Run `npm run typecheck` to catch the (many) call sites that read these fields.
5. Add CI step: `scripts/check-migration-safety.sh` runs in CI, fails if any `@@index` in `schema.prisma` doesn't have a matching `CREATE INDEX` in the migrations.

### Verification
- `npx prisma migrate status` exits 0.
- `npm run typecheck` passes.
- All 1902 web unit tests pass.
- 116 web test files load without compile errors.

### Risk
- **HIGH.** Touches the rider model — the most-read model. If a call site still reads `rider.lifecycleStatus`, it will throw at runtime. The typecheck will catch it; the tests will catch it; the staging soak will catch it.

---

## PR-72 — Verify `cache_indexes_v2` SQL vs schema `@@index` declarations

**Audit:** Database N2
**File:** `web/prisma/migrations/20260802000000_cache_indexes_v2/migration.sql`
**Risk:** LOW — read-only verification.

### Steps
1. Run `npx prisma migrate diff --from-migrations web/prisma/migrations --to-schema-datamodel web/prisma/schema.prisma --shadow-database-url $SHADOW_DATABASE_URL > /tmp/diff.sql`.
2. Grep the diff for any `CREATE INDEX` or `DROP INDEX` that doesn't match a `@@index` in the schema.
3. If they drift, fix the migration SQL (use `IF NOT EXISTS` and explicit table names) and add a `scripts/check-index-drift.sh` CI step.
4. If they match, just add the `check-index-drift.sh` script for future-proofing.

### Verification
- `prisma migrate diff` produces no `@@index`-related SQL.
- `check-index-drift.sh` exits 0.

---

## PR-55 — Fix `session.role !== 'SUPER_ADMIN'` broken gate

**Audit:** API N1 / Security carry-over
**File:** `web/src/app/api/admin/maintenance-mode/route.ts:40`, `web/src/app/api/admin/system-settings/route.ts:81`
**Risk:** LOW — single-field typo fix.

### Steps
1. In `maintenance-mode/route.ts:40` and `system-settings/route.ts:81`, replace:
   ```ts
   if (session.role !== 'SUPER_ADMIN') { return 403 }
   ```
   with:
   ```ts
   if (!hasPermission(session, 'settings:write')) { return 403 }
   ```
2. Import `hasPermission` from `@/lib/permissions`.
3. Add unit tests:
   - `test('SUPER_ADMIN can flip maintenance mode', ...)`
   - `test('FINANCE_ADMIN cannot flip maintenance mode', ...)`
   - Same for system-settings.

### Why this PR is critical
The maintenance-mode feature is **dead to all admins** today. SUPER_ADMIN is a real role but `session.role` is `'admin'`, not `'SUPER_ADMIN'`. The check always returns 403. Naive "fix" (changing to `session.role === 'SUPER_ADMIN'`) would invert into a full privilege hole.

### Verification
- The 2 dead routes accept POSTs from a real SUPER_ADMIN.
- The 2 dead routes reject POSTs from FINANCE_ADMIN.
- `npm test tests/unit/api/maintenance-mode.test.ts` (new file) passes.

---

## PR-56 — Replace `x-admin-id` header reads with `session.adminId`

**Audit:** API N2 / Security carry-over
**Files:** `admin/admins/route.ts:65,103`, `admin/feature-flags/route.ts:66`, `admin/faqs/route.ts:42,65,82`, `admin/legal/route.ts:35`, `admin/settings/route.ts:36`
**Risk:** LOW — variable rename.

### Steps
1. In each of the 7 sites, replace `req.headers.get('x-admin-id') || 'system'` with `session.adminId`.
2. Add ESLint rule to forbid `req.headers.get('x-admin-id')` in admin routes (catches future regressions).
3. Add unit test: `admin/admins/route.ts` POST records the actor as `session.adminId`, not the client-supplied header.

### Why this matters
The audit log is supposed to be non-repudiable. With the header read, an admin can attribute their destructive action to another admin (or to `system`). This defeats the purpose of the audit trail.

---

## PR-57 — Add `createAuditLog` to data-deletion + replace `Math.random()`

**Audit:** API carry-over / Security carry-over
**File:** `web/src/app/api/admin/riders/[id]/data-deletion/route.ts:41,97`
**Risk:** LOW — additive.

### Steps
1. At the start of the handler, call `createAuditLog({ action: 'RIDER_DATA_DELETION_INITIATED', actorId: session.adminId, entity: 'Rider', entityId: riderId, details: { fields: [...] } })`.
2. At the end (after the anonymization), call `createAuditLog({ action: 'RIDER_DATA_DELETION_COMPLETED', actorId: session.adminId, entity: 'Rider', entityId: riderId })`.
3. Replace `Math.random()` with `crypto.randomUUID()` for the anonymization suffix.
4. Add a 2-person approval gate: require a `confirmAdminId` in the body that differs from `session.adminId`. If same, return 400.
5. Add unit tests for both the audit log + the 2-person rule.

### Why this matters
This is a real PII destruction surface. A single rogue admin can destroy a rider's Aadhaar/PAN/IFSC data with **no audit trail** and **no approval**. `Math.random()` is not cryptographically secure.

---

## PR-60 — Fix impersonation header trust check

**Audit:** Security N1
**File:** `web/src/lib/get-session.ts:117,147`
**Risk:** LOW — single-line fix.

### Steps
1. Replace `if (process.env.NODE_ENV !== 'production')` with `if (process.env.APP_ENV !== 'production')` in both `getAdminId` and `getRiderId`.
2. Add unit test: `getAdminId` returns `null` when `APP_ENV=staging` and `NODE_ENV=production`.

### Why this matters
The current check trusts the impersonation header in any non-`production` env. A staging deploy with `NODE_ENV=development` (intentional for hot-reload) would leak impersonation into prod-like traffic.

---

## PR-61 — Add length check to `cron-auth.ts` `timingSafeEqual`

**Audit:** Security N2
**File:** `web/src/lib/cron-auth.ts:35`
**Risk:** LOW — defensive check.

### Steps
1. Before `timingSafeEqual`, check `expected.length === 0` → return 503. Check `expected.length !== provided.length` → return 401.
2. Add unit test: `requireCronSecret` with a 1-byte `CRON_SECRET` returns 503, not 500.

### Why this matters
`crypto.timingSafeEqual` throws if buffers have different lengths. A 1-byte secret (or unset secret) causes a 500 on every cron request. Worse, an unset secret reads as `undefined` → `Buffer.from(undefined, 'utf8')` is empty → length mismatch → throw → 500.

---

## PR-58 — Add `requirePermission` to admin/jobs POST

**Audit:** API carry-over
**File:** `web/src/app/api/admin/jobs/route.ts:22,141,158,296`
**Risk:** LOW — additive.

### Steps
1. Replace `const admin = await requireAdmin()` (line 22 and 141) with `const admin = await requirePermission('jobs:run')`.
2. Add the `'jobs:run'` permission to `lib/permissions.ts` PERMISSIONS const.
3. Add `jobs:run` to the SUPER_ADMIN role's default permission set in `RolePermission` seed.
4. Add unit test: `admin/jobs` POST returns 403 for a FINANCE_ADMIN.

### Why this matters
A READ_ONLY admin can currently fire `auto-debit`, `daily-engagement`, `wallet-reconciliation` — all of which mutate state. The current `requireAdmin()` check is the weakest possible.

---

## Phase 1 verification gate

After PR-71 through PR-58 ship, the following must be true before Phase 2:

- [ ] `npx prisma migrate status` is clean (PR-71)
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (1902+ tests)
- [ ] `flutter analyze` is 0 issues
- [ ] All 7 single-file P0 PRs merged to main
- [ ] One full staging deploy cycle completed (rehearsal for 2026-08-06)

---

# Phase 2 — Visible-to-user fixes

**Theme:** user-visible defects. Brand drift, photo upload blocking, missing audit logs in admin panel. 3 days.

**7 PRs, ~200 LOC.**

## PR-59 — Fix brand primary drift

**Audit:** Design system N1
**File:** `web/src/app/globals.css:62`
**Risk:** TRIVIAL — 1-line change.

### Steps
1. Replace `--primary: #0369a1;` with `--primary: var(--color-vf-primary);` in `:root` and `.dark`.
2. Run the admin panel visually — every `bg-primary` button should now be Voltium Blue `#0053C1`.
3. Add a unit test: render `<Button>Click me</Button>` in a Storybook story, assert the computed `background-color` is `rgb(0, 83, 193)`.

### Why this matters
The brand spec is unambiguous: Voltium Blue is `#0053C1`. The admin panel currently renders a different blue (`#0369a1`, sky-700). Side-by-side with the rider app, the inconsistency is visible.

---

## PR-66 — Fix rider app photo upload (parallel + progress)

**Audit:** Rider app N1-revised
**File:** `flutter/lib/features/rentals/presentation/screens/vehicle_photos_screen.dart:67`
**Risk:** MEDIUM — async control flow change.

### Steps
1. Replace the sequential `for (final photo in photos) { await uploadFile(...) }` with `await Future.wait(photos.map(uploadFile))`.
2. Add a `LinearProgressIndicator` driven by the number of completed uploads.
3. Add a Cancel button that closes the `http.Client` to abort in-flight uploads.
4. Add golden test: 4-photo upload shows correct progress states (0/4, 1/4, 2/4, 3/4, 4/4).

### Why this matters
Photos upload sequentially, each taking 2-5 seconds. With 8 photos on 3G, the user waits 8-40 seconds staring at a spinner. No progress. No cancel. A user who closes the app mid-upload has partial state on the server.

---

## PR-67 — Call `rentalUseCases.submitVehicleReturn` after photo upload

**Audit:** Rider app N2
**File:** `flutter/lib/features/rentals/presentation/screens/vehicle_photos_screen.dart:67+`
**Risk:** MEDIUM — adds a state-machine transition that may fail.

### Steps
1. After `Future.wait(photos.map(uploadFile))` succeeds, call `rentalUseCases.submitVehicleReturn(photoUrls, reason: ...)`.
2. On success, navigate to the success screen.
3. On failure, show the error AND keep the uploaded photo URLs visible (so the rider can retry without re-uploading).
4. Add integration test: upload 4 photos → submitVehicleReturn called with the photo URLs.

### Why this matters
Today, the rider uploads photos but the rental is **not** marked as "return submitted" in the backend. The admin dashboard still shows the rental as "ACTIVE" after the rider's "Photos submitted" toast. A real PII + money correctness bug.

---

## PR-64 — Add audit log to incident severity change

**Audit:** Admin panel N2
**Files:** `web/src/components/admin/screens/incident-management/IncidentDetailSheet.tsx:85`, `web/src/server/modules/incidents/incident.use-cases.ts`
**Risk:** LOW — additive.

### Steps
1. In `incident.use-cases.ts:updateSeverity()` (or equivalent), call `createAuditLog({ action: 'INCIDENT_SEVERITY_CHANGED', actorId, entity: 'Incident', entityId, details: { from, to, reason } })`.
2. Add unit test: `updateSeverity` writes an audit row with the from/to values.

### Why this matters
Severity escalations are the most operationally important admin action. They should be auditable.

---

## PR-63 — Add double-click protection to BackgroundJobsScreen "Run now"

**Audit:** Admin panel N1
**File:** `web/src/components/admin/screens/BackgroundJobsScreen.tsx:160`
**Risk:** LOW.

### Steps
1. Add `useMutation` from React Query (already used elsewhere in admin) around the trigger.
2. Set `disabled={mutation.isPending}` on the button.
3. Add server-side idempotency key on the job trigger (use the existing `IdempotencyKey` table).
4. Add unit test: double-click on "Run now" fires the trigger only once.

### Why this matters
Double-click on "Run now" fires two parallel job executions. For `wallet-reconciliation` that's two scans of the ledger in parallel — possible double-write of `ReconciliationReport` rows.

---

## PR-65 — Hide "Reset Password" button in RiderDetailDialog

**Audit:** Admin panel N3
**File:** `web/src/components/admin/screens/rider-management/RiderDetailDialog.tsx`
**Risk:** TRIVIAL.

### Steps
1. Wrap the "Reset Password" button in a feature flag check: `{(await isFeatureEnabled('rider.reset_password')) && <Button ...>}`.
2. The feature flag defaults to `false` (button hidden by default).
3. Add a follow-up ticket: implement `/api/admin/riders/[id]/reset-password` route + flip the flag.

### Why this matters
The button calls a route that doesn't exist (404). The admin sees a generic "Something went wrong" toast with no indication of why.

---

## PR-62 — Add `onPrimaryContainer` and 9 surface tokens to Flutter theme

**Audit:** Design system N2 + N5
**Files:** `flutter/lib/theme/app_colors.dart`, `flutter/lib/theme/app_theme.dart`
**Risk:** LOW — additive.

### Steps
1. Add `AppColors.onPrimaryContainer` (light: `#001a41`, dark: `#d6e3ff`).
2. Add `AppColors.warningForeground` (light: `#7c2d12` — for the WCAG fix; see N1 of design system audit).
3. In `AppTheme.lightTheme`, wire all 11 surface tokens to `ThemeData.colorScheme`:
   - `surfaceContainerLow`, `surfaceContainerLowest`, `surfaceContainerHigh`
   - `onSurfaceVariant`, `onSurfaceMuted`
   - `outline`, `outlineVariant`
   - `secondaryContainer`, `tertiaryContainer`, `tertiary`, `onTertiary`
4. Same for `AppTheme.darkTheme`.
5. Migrate 5 components to use the theme tokens instead of `AppColors.of(context)` direct lookups.

### Why this matters
9 of 11 surface tokens are defined in `AppColors` but not wired to `ThemeData.colorScheme`. Every new component makes a choice between the two; most pick `AppColors.X` and lose dark-mode support. Plus, `warning` + `warningLight` fail WCAG AA (2.1:1 contrast).

---

## Phase 2 verification gate

- [ ] Brand color #0053C1 visible on `<Button>` in admin panel
- [ ] Photo upload shows progress, parallel, cancellable
- [ ] Photo upload calls `submitVehicleReturn` on success
- [ ] Incident severity change writes audit row
- [ ] "Run now" button disabled during in-flight request
- [ ] "Reset Password" button hidden
- [ ] 9 surface tokens wired, 5 components migrated
- [ ] All tests pass; golden tests regenerated

---

# Phase 3 — Performance & scale

**Theme:** pre-staging-soak infrastructure. Lint debt, memory leak, queue starvation, statement timeout. 2-3 days.

**8 PRs, ~150 LOC.**

## PR-68 — Set `--max-warnings 0` and resolve 9 pre-existing ESLint warnings

**Audit:** Infrastructure N1
**Files:** `web/.github/workflows/ci-cd.yml:35`, `web/.eslintrc.json`
**Risk:** LOW.

### Steps
1. Set `cross-env NODE_OPTIONS=--max-old-space-size=4096 eslint . --max-warnings 0` in `ci-cd.yml`.
2. Resolve the 9 pre-existing warnings:
   - 6 "Unused eslint-disable directive" in `web/coverage/...js` → add `coverage/**` to `.eslintignore`.
   - 1 "Google Font preconnect missing" → already added the `<link rel="preconnect">` in PR-40; verify the warning is gone.
   - 2 "Custom fonts not added in `pages/_document.js`" → add a `.eslintrc.json` exception for `app/layout.tsx` with a comment explaining the Next.js App Router doesn't use `pages/_document.js`.
3. Add `coverage/**` to `.eslintignore`.
4. Run `npm run lint` — expect 0 errors, 0 warnings.

### Why this matters
A budget of 800 warnings lets the build pass with up to 799 real warnings. Real bugs hide in noise.

---

## PR-69 — Add `max_memory_restart: '1G'` to PM2 workers

**Audit:** Infrastructure N2
**File:** `ecosystem.config.js`
**Risk:** LOW.

### Steps
1. Add `max_memory_restart: '1G'` to each of the 4 Next.js worker entries.
2. Verify with `pm2 ls` after deploy.
3. Add a Playwright load test that triggers 100 concurrent requests and asserts the workers don't restart.

### Why this matters
A bad query that returns 1M rows can balloon a worker to 2GB. With 4 workers that's 8GB resident. PM2 doesn't restart them; the system OOMs.

---

## PR-70 — Verify wallet-reconciliation column references

**Audit:** Backend N1
**File:** `web/src/server/workers/jobs/wallet-reconciliation.job.ts:32-58`
**Risk:** LOW — verification + possible column-name fix.

### Steps
1. Read the current job. Identify whether the `SUM(...)` query references `Transaction.amountInPaise` (correct) or `Transaction.amount` (stale, post-rename).
2. If stale, update the SQL.
3. If correct, add a unit test that constructs a known transaction set and asserts the drift calculation.
4. Run `npm test tests/unit/wallet-reconciliation.test.ts` (new file).

### Why this matters
The column rename in `20260729150000_float_to_paise` may have left a stale reference. The job runs daily at 02:00 IST; if it throws, the daily reconciliation report is missing.

---

## PR-75 — Separate `JobQueue` for interactive vs background jobs

**Audit:** Backend N2
**File:** `web/src/server/workers/queues.ts`
**Risk:** MEDIUM — affects the worker process.
**Status:** SHIPPED (2026-08-03) — see commit for the actual implementation.

### Steps (as planned)
1. Instantiate 2 `JobQueue` instances: `interactiveQueue` and `backgroundQueue`.
2. Classify each of the 11 jobs: `interactive` (rent-due, referral-reward, daily-engagement, notification-dispatch) vs `background` (telemetry-cleanup, audit-cleanup, scheduled-backup, wallet-reconciliation, notifications-cleanup, device-compliance, reconciliation).
3. In the `/api/internal/worker` route, poll `interactive` first, then `background` if idle.
4. Add unit test: enqueue 100 background jobs, then 1 interactive job; the interactive job is processed first.

### Implementation notes (deviations from plan)
The plan called for two `JobQueue` instances, but the real `JobQueue`
class is a singleton object exported from `web/src/lib/job-queue.ts`
(const `JobQueue = { ...methods... }`) — not a class that can be
instantiated twice. Rather than refactor the singleton into a class
(unnecessary churn, ~200 LOC), the implementation took a smaller-LOC
alternative:

1. Added a `priority` column to `OutboxEvent` (`interactive` | `background`,
   default `background`) with a partial composite index
   `(priority, status, createdAt)`. See
   `prisma/migrations/20260803152322_add_outbox_priority/`.
2. Made `JobQueue.processJobs` accept an optional `priority` arg that
   filters the claim query. The default (no arg) preserves the
   pre-PR-75 FIFO behavior, so all 4 existing callers (the route +
   the orchestrator) keep working unchanged.
3. Made `OutboxService.emit` accept an optional `priority` arg. The
   orchestrator passes `'interactive'` for the 4 latency-sensitive
   event types (SMS_SEND, NOTIFICATION_SEND, RENT_DUE_CHECK,
   DAILY_ENGAGEMENT, REFERRAL_REWARD, RENT_OVERDUE) and the default
   for the rest.
4. In `web/src/server/workers/index.ts`, the `WorkerDefinition` and
   `runWorkerLoop` now declare a `priority` per worker. Background
   workers call a new `hasPendingInteractive()` helper on each tick
   and skip the claim if any interactive event is PENDING. The
   `web/src/app/api/internal/worker/route.ts` also passes
   `priority: 'interactive'` so the manual trigger / fallback can
   never pick up a background event.

### Classification (final, with file rename correction)
The plan listed `rent-due` but the actual file is
`web/src/server/workers/jobs/rent-reminders.job.ts` (renamed in a
prior refactor; the audit's `rent-due` is the conceptual job name).
The interactive list is:

| Job (file) | Event type | Priority | Reason |
| --- | --- | --- | --- |
| `rent-reminders.job.ts` | `rent.due_check` | interactive | Auto-debit + SMS receipt, latency-sensitive |
| `referral-reward.job.ts` | `referral.reward` | interactive | ₹100 credit + push, UX-facing |
| `daily-engagement.job.ts` | `engagement.daily` | interactive | 06:00 IST birthday wishes + payment reminders |
| `notification-dispatch.job.ts` | `notification.send` | interactive | KYC/wallet/support push notifications |
| `reconciliation.job.ts` | `wallet.reconciliation` | background | Daily drift report, no rider-visible side effects |
| `audit-cleanup.job.ts` | (cron) | background | Expired-log deletion, no UI |
| `telemetry-cleanup.job.ts` | (cron) | background | Old location/call/contact purge, 10-min potential |
| `scheduled-backup.job.ts` | (cron) | background | DB dump, heavyweight |
| `wallet-reconciliation.job.ts` | (admin trigger) | background | On-demand drift report |
| `notifications-cleanup.job.ts` | (cron) | background | Old notification purge |
| `device-compliance.job.ts` | `device.violation_scan` | background | Per-minute rider scan, no UX urgency |

The audit plan listed 4 interactive + 7 background = 11 jobs. The
final split is 4 interactive + 7 background = 11 jobs. ✓

### Pre-existing outbox events
The audit called out that the audit doc shows `WALLET_TOPUP_APPROVED`
/ `WALLET_TOPUP_REJECTED` event types emitted from
`wallet.use-cases.ts` but no worker is registered for those event
types in `web/src/server/workers/index.ts` (only `NOTIFICATION_SEND`
is registered; it dispatches by `payload.type` but the wallet path
emits the wallet-specific event type, not NOTIFICATION_SEND). The
PR-75 priority classification for these events is therefore moot —
no worker will pick them up either way. **Filed as a follow-up
ticket for a separate fix.**

### Why this matters
A 10-minute telemetry cleanup will starve 1-second rent-due SMS. The
current single-queue design has no priority.

---

## PR-73 — Add `AuditLog(entity, entityId)` composite index

**Audit:** Database N3
**File:** `web/prisma/schema.prisma` (`AuditLog` model)
**Risk:** LOW.

### Steps
1. Add `@@index([entity, entityId])` to the `AuditLog` model.
2. Create migration `20260803000000_audit_log_entity_composite_index/migration.sql` with `CREATE INDEX CONCURRENTLY`.
3. Run `prisma migrate dev` to verify.
4. Add unit test: `db.auditLog.findMany({ where: { entity: 'Rider', entityId: 'xxx' } })` uses the index (verify with `EXPLAIN`).

### Why this matters
The admin AuditLog screen does a `WHERE entity = ? AND entityId = ?` query. Without the index, it's a sequential scan + in-memory filter.

---

## PR-74 — Add `statement_timeout` to DATABASE_URL

**Audit:** Infrastructure N3
**Files:** `.env.example`, `ecosystem.config.js`
**Risk:** MEDIUM — kills long queries.

### Steps
1. Add `?statement_timeout=60s` to the `DATABASE_URL` in `.env.example` and `ecosystem.config.js`.
2. Add unit test: a query that sleeps for 70s is killed at 60s.
3. Verify no legitimate query in the app exceeds 60s.

### Why this matters
With a connection pool of 4, a single 5-minute analytics query holds 1 of 4 connections for the full duration. The other 3 connections are still available, but if 5 such queries run in parallel, the pool is exhausted. The `statement_timeout` prevents runaway queries.

---

## PR-68b — `add ADD COLUMN NOT NULL` warning to check-migration-safety.sh

**Audit:** Database N7
**File:** `scripts/check-migration-safety.sh`
**Risk:** LOW.

### Steps
1. Add a pattern check for `ALTER TABLE.*ADD COLUMN.*NOT NULL[^,)]*\)` (NOT NULL without DEFAULT).
2. Output a `::warning::` annotation (not `::error::`) since some patterns are safe.
3. Verify with a synthetic migration.

### Why this matters
A `NOT NULL` column added without a `DEFAULT` will scan the entire table to backfill. For a `Transaction` table with 1M rows, that's a 30-minute write-lock.

---

## PR-68c — Add `retries: 5` to cloudflared config

**Audit:** Infrastructure N4
**File:** `cloudflared-config.example.yml`
**Risk:** TRIVIAL.

### Steps
1. Add `retries: 5` to the `tunnel:` config block.
2. Add a comment explaining the value.

### Why this matters
A flaky Cloudflare edge can disconnect the tunnel; without retries, the laptop-server connection is lost.

---

## Phase 3 verification gate

- [ ] `npm run lint` exits 0
- [ ] `pm2 ls` shows `max_memory_restart` on all workers
- [ ] `wallet-reconciliation` unit test passes
- [ ] `JobQueue` separates interactive from background
- [ ] `AuditLog(entity, entityId)` index exists
- [ ] `statement_timeout=60s` in `DATABASE_URL`
- [ ] Cloudflared config has `retries: 5`
- [ ] **Staging soak rehearsal complete**

---

# Phase 4 — Architecture refactors (multi-file P0s)

**Theme:** the systemic fixes. Each PR is bigger but reviewable. 1-2 weeks.

**5 PRs, ~700 LOC.**

## PR-26 — Wire `lib/validators/admin.ts` into all admin mutations

**Audit:** API N1
**Files:** `lib/validators/admin.ts` (already exists), all admin mutation routes
**Risk:** MEDIUM.

### Why this PR matters
The validator file exists with 6 schemas. **Zero routes use it** (`grep -r "from.*validators/admin" web/src/app/api` returns 0 matches). Every admin mutation accepts an unvalidated body, then destructures the fields it needs and passes them to Prisma. A client can add any field they want.

### Steps
1. For each of the 6 schemas in `lib/validators/admin.ts`, define the input type and the Zod schema (`.strict()`).
2. In each admin mutation route (`admin/admins/route.ts`, `admin/feature-flags/route.ts`, `admin/faqs/route.ts`, `admin/legal/route.ts`, `admin/settings/route.ts`, `admin/system-settings/route.ts`):
   - Import the schema.
   - Replace the manual destructure with `const parsed = schema.parse(await request.json())`.
   - Use the parsed object instead of the raw body.
3. Add unit tests for each route asserting that unknown fields are rejected.
4. Update `docs/API.md` with the new schema.

### Verification
- `npm test` (all 1902+ tests) passes.
- A request with `{ key: 'foo', value: 'bar', isSecret: true }` to `admin/system-settings` is rejected with 400.
- The 6 schemas are now imported by their routes.

---

## PR-26b — Extract `submitVehicleReturn` / `completePickupVerification` / `approveKyc` use cases

**Audit:** API N3 / Backend carry-over
**Files:** new `web/src/server/modules/rentals/use-cases/submitReturn.ts`, `web/src/server/modules/pickup/use-cases/completeVerification.ts`, `web/src/server/modules/kyc/use-cases/approveKyc.ts`
**Risk:** MEDIUM-HIGH — touches 3 state machines.

### Why this PR matters
`riderUseCases.updateProfile` is a chokepoint: a single function that every rider mutation routes through. The `.strict()` Zod allowlist in the request body keeps foreign keys out, but **cross-entity invariants** (e.g. "you can't be `RENTAL_ACTIVE` without a paid deposit") are not checked because the chokepoint is the generic profile update.

### Steps
1. Create `submitVehicleReturn(riderId, photoUrls, reason)` in `rentals/use-cases/submitReturn.ts`:
   - Verify rider is in `RENTAL_ACTIVE` state.
   - Verify photos count >= 4.
   - Transition `rentalStatus: ACTIVE → RETURN_PENDING`.
   - Create a `VehicleReturn` row.
   - Write audit log.
2. Create `completePickupVerification(riderId, hubId, photos, signature)` in `pickup/use-cases/completeVerification.ts`:
   - Verify rider is in `PICKUP_SCHEDULED` state.
   - Verify photos count >= 2 (front, back).
   - Set `pickupDone: true`, `pickupTimestamp: now()`, `pickupHubId: hubId`.
   - Transition `lifecycleStatus: PICKUP_SCHEDULED → ACTIVE`.
3. Create `approveKyc(riderId, approvedBy)` in `kyc/use-cases/approveKyc.ts`:
   - Verify KYC is in `KYC_SUBMITTED` state.
   - Set `kycStatus: approved`, `kycApprovedBy: approvedBy`, `kycApprovedAt: now()`.
   - Write audit log (no-op too — fix the carry-over).
4. Update the 3 corresponding routes to call the new use cases.
5. Add state-machine tests for each: 8x8 transition matrix + edge cases (already done in R4.6; add specific tests for these new use cases).

### Verification
- `riderUseCases.updateProfile` is no longer called from any route (verify with `grep`).
- All 3 new use cases have state-machine tests.
- The Flutter client calls the new use cases (PR-67 already does this for `submitVehicleReturn`).

---

## PR-27 — Add `web/src/components/ui/heading.tsx` + migrate 287 raw typography combos

**Audit:** Design system N6
**Files:** new `web/src/components/ui/heading.tsx`, then migrate 5-10 screens per PR
**Risk:** LOW (per PR), but volume is high (287 combos across 60 screens).

### Why this PR matters
Each admin screen has its own `<h1 className="text-2xl font-bold">`. There are 287 raw typography class combinations. The Flutter `AppTypography` defines a canonical set; web has no equivalent.

### Steps
1. Create `web/src/components/ui/heading.tsx`:
   ```tsx
   export function Heading({ level = 2, children, className }: { level: 1|2|3|4|5|6; children: ReactNode; className?: string }) {
     const Tag = `h${level}` as const;
     const styles = { 1: 'text-3xl font-bold', 2: 'text-2xl font-semibold', 3: 'text-xl font-semibold', 4: 'text-lg font-medium', 5: 'text-base font-medium', 6: 'text-sm font-medium' }[level];
     return <Tag className={cn(styles, className)}>{children}</Tag>;
   }
   ```
2. Migrate 10 screens in PR-27a, 10 in PR-27b, etc. (5-7 PRs total).
3. Add a Storybook story for each level.

### Verification
- 0 raw `text-2xl font-bold` / `text-xl font-semibold` etc. in `web/src/components/admin/screens/**`.
- Every screen uses `<Heading level={1|2|3}>` for headings.

---

## PR-28 — Add `--split-per-abi` to `flutter-ci-cd.yml`

**Audit:** Rider app N6
**File:** `flutter/.github/workflows/flutter-ci-cd.yml`
**Risk:** TRIVIAL.

### Steps
1. Add `--split-per-abi` to the build command.
2. Distribute `app-arm64-v8a-release.apk` to ARM64 devices, `app-armeabi-v7a-release.apk` to ARMv7 devices, `app-x86_64-release.apk` to x86_64 emulators.
3. Update `docs/BUILD.md` with the new build artifacts.

### Verification
- Universal APK is 35MB; per-ABI APKs are ~14MB each (60% reduction).
- Play Store / device install succeeds on each ABI.

---

## PR-29 — Migrate 41 raw `<button>` to shadcn `<Button>`

**Audit:** Admin panel N7
**Files:** various admin screens
**Risk:** LOW.

### Steps
1. In each admin screen, replace `<button className="...">` with `<Button variant="...">`.
2. Standardize on 3 variants: `default`, `outline`, `ghost`.
3. Run `npm run lint` — no more raw button classes.

### Verification
- 0 raw `<button>` tags in `web/src/components/admin/screens/**` (except in special cases like form submission).
- All buttons have consistent visual style.

---

# Phase 5 — P1s and P2s (housekeeping)

**Theme:** the smaller-but-still-important items. 1-2 weeks.

**~15 PRs, ~500 LOC.**

This phase is open-ended; the audit surfaced ~30 P1s and ~10 P2s. Group by scope:

### Backend P1s
- **PR-30** — wrap `sendSms` in circuit breaker (N4 of backend audit).
- **PR-31** — add no-op audit row in `kycUseCases.approveKyc` (N5).
- **PR-32** — fix `cancelledAt` filter in analytics (N6).
- **PR-33** — add per-poll `LIMIT` and DLQ to outbox (N3).
- **PR-34** — add per-event-type timeout to `processNext` (carry-over #6).
- **PR-35** — fix `notification-dispatch.job.ts` retry backoff (carry-over #15).

### Database P1s
- **PR-36** — drop zero-scan indexes from `Rider` and other high-write tables (needs a 1-week `pg_stat_user_indexes` data window first).
- **PR-37** — fix `EXTRACT(EPOCH FROM ...)` to `INTERVAL` in analytics (N6).
- **PR-38** — add partial index on `Notification.entityId` and `OutboxEvent.entityId` (N4).

### Admin P1s
- **PR-39** — fix `AuditLogScreen` pagination (N5 of admin audit).
- **PR-40** — guard `WorkflowCoverageScreen` with `NODE_ENV !== 'development'` (N6).
- **PR-41** — add `x-request-id` to `adminApi` (N8).
- **PR-42** — implement CSV export for `RiderManagement` (N9).

### Rider P1s
- **PR-43** — add `stopAllTimers()` to `DevicePolicyProvider` + call from `RiderProvider.logout()` (N8 of rider audit).
- **PR-44** — add Indian phone validator to guarantor form (N4).
- **PR-45** — add back button to `LegalPageScreen` (N3).
- **PR-46** — invalidate plan provider on `ChoosePlanScreen` initState (N5).
- **PR-47** — remove `placeholder.png` from production asset bundle (N7).

### Design system P1s/P2s
- **PR-48** — make `ThemeNotifier.build()` async so dark-mode preference loads before first frame (N3-revised).
- **PR-49** — add `defaultTheme="system" enableSystem` to `next-themes` (N4).
- **PR-50** — replace `bg-slate-50` / `bg-gray-50` with `bg-background` in 22 admin screens (N7).
- **PR-51** — auto-generate `design-tokens.json` from `globals.css` (N8).

### Security P1s
- **PR-52** — add timing-safe compare to `internal/worker` using `cron-auth.ts` helper.
- **PR-53** — wrap every use-case business-mutation + audit-log pair in `prisma.$transaction` (multi-file; 5 sub-PRs).
- **PR-54** — wire 29 unused permissions or delete them.
- **PR-55** — centralize sensitive-field redaction list.

### Infrastructure P1s
- **PR-56** — wire OpenTelemetry in rider app.
- **PR-57** — add Grafana panels for `/api/rider/device` and `/api/internal/worker`.
- **PR-58** — add CI check `connection_limit * worker_count > 80` to surface PG pool exhaustion early.

---

# Cross-cutting verification

**The 5 phases must be completed in order.** Phase 1 unblocks the staging soak. Phase 2 makes the visible defects disappear. Phase 3 hardens the infrastructure for the post-soak load. Phase 4 fixes the systemic issues. Phase 5 polishes.

After every PR:
1. `npm run lint && npm run typecheck`
2. `npm test` (1902+ tests)
3. `flutter analyze` (0 issues)
4. `flutter test` (all unit + golden)
5. `prisma migrate status` (clean)
6. `git push` → wait for `ci-cd.yml` to pass

After each phase:
1. One full staging deploy cycle
2. Run the integration test suite (`flutter/integration_test/`)
3. Run the load test (`nightly-load.yml`)
4. Review the 5 audit docs and update the "STILL REAL" sections

After all 5 phases:
1. Run the public-beta-readiness check (`scripts/check-public-beta-ready.sh`)
2. Update `docs/PUBLIC_BETA_READINESS.md`
3. Schedule the R6 drop with confidence

---

# What this plan does NOT cover

- **External services** (Razorpay, Firebase, PostHog, Sentry): not in scope of the 8 audits.
- **Compliance** (PCI-DSS, Aadhaar storage): not in scope; `docs/PII_POLICY.md` exists.
- **Hardware / deployment**: laptop-service architecture is assumed correct (`docs/LAPTOP_SERVICE_ARCHITECTURE.md`).
- **Pre-staging-soak rehearsal**: the 2026-08-06 staging soak is gated on Phase 1. The plan assumes Phase 1 ships before 2026-08-06.
- **The 2026-08-06 staging soak itself**: managed by the runbook (`docs/RUNBOOK_DB_DROPS_2026-08-06.md`).

---

# Open questions for the user

1. **Who owns the work?** One engineer for 5-6 weeks, or split across multiple? The single-file P0s are review-friendly and can be parallelized; the architecture refactors (Phase 4) benefit from one owner.
2. **What about R6 timing?** The plan assumes Phase 1 ships before 2026-08-06. If it slips, the staging soak is at risk.
3. **Should we deprioritize the multi-file P0s (Phase 4) until the staging soak is done?** They touch 3 state machines (rental, pickup, KYC) — risk of regression during the soak.
4. **The 287 raw typography combos in Phase 4** — that's 5-7 sub-PRs. Do you want them all in one batch, or spread across 2-3 sprints?
