# Voltium — 8-Scope Deep Audit Index (2026-08-03)

**Date:** 2026-08-03
**Audits delivered (8 files):**

| # | Scope | File | Carry-over P0s (still real) | NEW P0s |
|---|---|---|---|---|
| 1 | API | `docs/AUDIT_API_2026-08-03.md` | 4 | 3 |
| 2 | Backend | `docs/AUDIT_BACKEND_2026-08-03.md` | 5 | 2 |
| 3 | Database | `docs/AUDIT_DATABASE_2026-08-03.md` | 3 | 2 |
| 4 | Design system | `docs/AUDIT_DESIGN_SYSTEM_2026-08-03.md` | 4 | 2 |
| 5 | Admin panel | `docs/AUDIT_ADMIN_PANEL_2026-08-03.md` | 5 | 3 |
| 6 | Rider app | `docs/AUDIT_RIDER_APP_2026-08-03.md` | 4 | 2 |
| 7 | Infrastructure | `docs/AUDIT_INFRASTRUCTURE_2026-08-03.md` | 3 | 2 |
| 8 | Security | `docs/AUDIT_SECURITY_2026-08-03.md` | 5 | 2 |
| | **TOTALS** | | **33** | **18** |

**Baseline documents:** the 2026-08-01 deep audits (`docs/DEEP_AUDIT_*_2026-08-01.md`) and the older `docs/AUDIT_*` family. The 2026-08-01 audits covered API/Backend/Database/Design System/Infrastructure/Security but NOT Admin Panel or Rider App — those have their own July-era `docs/AUDIT_FINDINGS_ADMINPANEL.md` and `docs/AUDIT_FINDINGS_RIDERAPP.md` which I used as the baseline for those two scopes.

---

## Executive Summary

This is a single-session re-audit covering 8 scopes, with explicit `file:line` evidence for every claim. The 48-hour delta since the 2026-08-01 deep audits is dominated by:

1. **R4 Riverpod migration** (PR-47 → PR-54): 11 `ChangeNotifier` providers converted to `Notifier<State>` + `NotifierProvider` in the rider app. Auth flow now returns sealed `AppState`. Polling scoped to `ActiveDashboard`. 8x8 state-machine tests added. **Biggest single-session refactor in months — no security regression.**
2. **CACHE_RECOMMENDATIONS implementation** (PR-28 → PR-31, PR-38, PR-39, PR-40): server cache layer + 30+ admin routes get `withCacheHeaders` + `getOrSetResponse` + client-side GET dedup. **No security regression.**
3. **5 admin screen splits** (PR-44): TransactionManagement, IncidentManagementScreen, AdminUserManagement, HubManagement, OfferManagement — each split into a sub-folder with barrel + dynamic imports. **No regression.**
4. **Flutter widget splits** (PR-42): 62 files touched; 1000-line `guarantor_onboarding_widgets.dart` → 8 files. **No regression.**

**The 2026-08-01 deep audits' 4 "CONFIRMED STILL REAL" P0s in the API surface remain unchanged:**
- `session.role !== 'SUPER_ADMIN'` broken gate in maintenance-mode + system-settings.
- `x-admin-id` header used as audit actor in 5 admin files.
- `/api/admin/jobs` no `hasPermission` guard + sync execution + internals leak.
- `/api/admin/riders/[id]/data-deletion` no audit log + `Math.random()` for anonymization.

**The 18 NEW P0s added in this round are listed below.**

---

## The 18 NEW P0s (consolidated, review-ready order)

These are the issues surfaced by the 2026-08-03 re-audit that weren't in the 2026-08-01 audit. Ordered by `file:line` blast radius and review-friendliness (single-file PRs first, multi-file PRs last).

### Tier 1: Single-file P0s (review-friendly, ship in 1 PR each)

| # | Audit | File:line | Issue | Fix LOC |
|---|---|---|---|---|
| 1 | API | `admin/maintenance-mode/route.ts:40`, `admin/system-settings/route.ts:81` | `session.role !== 'SUPER_ADMIN'` broken gate (carries over) | 10 |
| 2 | API | `admin/admins/route.ts:65,103`, `admin/feature-flags/route.ts:66`, `admin/faqs/route.ts:42,65,82`, `admin/legal/route.ts:35`, `admin/settings/route.ts:36` | `x-admin-id` header used as audit actor (carries over) | 20 |
| 3 | API | `admin/jobs/route.ts:22,141,158,296` | `requireAdmin()` only, sync execution, internals leak (carries over) | 30 |
| 4 | API | `admin/riders/[id]/data-deletion/route.ts:41` | No `createAuditLog`, `Math.random()` for anonymization (carries over) | 30 |
| 5 | API | `admin/feature-flags/route.ts:36-50`, `admin/faqs/route.ts:42,65,82`, `admin/legal/route.ts:35`, `admin/settings/route.ts:36` | No Zod `.strict()` schema — body fields unrestricted | 200 |
| 6 | API | `admin/system-settings/route.ts:81+` | `isSecret` field can be flipped by client to mask settings | 50 |
| 7 | Security | `web/src/lib/get-session.ts:117,147` | `NODE_ENV !== 'production'` lets impersonation leak in misconfigured staging | 2 |
| 8 | Security | `web/src/lib/cron-auth.ts:35` | `timingSafeEqual` without length check — 1-byte secret crashes route | 5 |
| 9 | Backend | `web/src/server/workers/jobs/wallet-reconciliation.job.ts:32-58` | Column rename half-applied (verify first) | 10 |
| 10 | Backend | `web/src/server/workers/queues.ts` | All 11 jobs share a single queue — slow job blocks interactive | 80 |
| 11 | Backend | `web/src/server/modules/rider/rider.use-cases.ts` | `updateProfile` is a chokepoint that bypasses cross-entity invariants (API N3) | 500 |
| 12 | Database | `web/prisma/schema.prisma` | 2026-08-06 migrations on disk but legacy columns still in schema | 30 |
| 13 | Database | `web/prisma/schema.prisma` (AuditLog) | `@@index([entity, entityId])` missing | 5 |
| 14 | Database | `web/prisma/migrations/20260802000000_cache_indexes_v2/migration.sql` | `@@index` declarations vs migration SQL never verified | 50 |
| 15 | Design system | `web/src/app/globals.css:62` | `--primary` is `#0369a1` (sky-700), not brand `#0053C1` | 1 |
| 16 | Design system | `flutter/lib/theme/app_colors.dart` | `warning` + `warningLight` fail WCAG AA (2.1:1 contrast) | 3 |
| 17 | Design system | `flutter/lib/theme/app_theme.dart:50-95` | 9 of 11 surface tokens not wired to `ThemeData.colorScheme` | 30 |
| 18 | Admin panel | `BackgroundJobsScreen.tsx:160` | "Run now" button has no double-click protection | 10 |
| 19 | Admin panel | `IncidentDetailSheet.tsx:85` | Severity change has no audit log entry | 5 |
| 20 | Admin panel | `RiderDetailDialog.tsx` | "Reset Password" button calls non-existent route (404) | 2 (hide button) |
| 21 | Rider app | `vehicle_photos_screen.dart:67` | Photos upload sequentially with no progress indicator (8-40s blocking) | 30 |
| 22 | Rider app | `vehicle_photos_screen.dart:67+` | `rentalUseCases.submitVehicleReturn` not called after upload | 20 |
| 23 | Infrastructure | `ci-cd.yml:35` | `--max-warnings 800` lets lint debt grow unchecked | 1 + 30 (.eslintrc) |
| 24 | Infrastructure | `ecosystem.config.js` | No `max_memory_restart` — workers balloon to 4GB | 4 |

**24 single-file P0s in total.** Average fix size: ~30 LOC. Average test additions: ~3 per PR.

### Tier 2: Multi-file P0s (require 1-3 PRs each)

| # | Audit | Issue | Estimated LOC | Estimated PRs |
|---|---|---|---|---|
| 25 | API | Wire `lib/validators/admin.ts` into all admin mutations (#5 above) | 200 | 1 |
| 26 | Backend | Extract `submitVehicleReturn` / `completePickupVerification` / `approveKyc` use cases (#11 above) | 500 | 3 |
| 27 | Design system | Add `web/src/components/ui/heading.tsx` + migrate 287 raw typography combos | 60 + ~150 per migration | 5 |
| 28 | Admin panel | Migrate 41 raw `<button>` to shadcn `<Button>` | ~60 | 2 |
| 29 | Rider app | Add `--split-per-abi` to flutter-ci-cd.yml (60% APK size reduction) | 1 | 1 |

---

## Cross-cutting themes

### Theme 1: "Broken gate" pattern — RBAC checks using the wrong field
The most common P0 in this audit cycle is an RBAC check that uses `session.role` (a string like `'admin'` or `'rider'`) where it should use `session.adminRole` (the role name like `'SUPER_ADMIN'`). Two routes have this bug today; if "fixed" naively, it inverts into a privilege hole. **Pattern:** any check involving admin roles should use `hasPermission(session, '<permission>')` (a function that resolves the right field) or `session.adminRole` (the actual field).

### Theme 2: Audit log not a transaction participant
`createAuditLog` writes its DB row in a separate `db.auditLog.create()` call after the business mutation. If the request fails after the mutation but before the audit row commits, the audit log silently misses. Affects every use case that mutates state. **Pattern:** wrap the business mutation + audit log in `prisma.$transaction([...])`.

### Theme 3: Schema vs. migration drift
The 2026-08-06 migrations exist on disk but `schema.prisma` doesn't reflect them. A new developer running `prisma migrate dev` will see "schema is out of sync" warnings. A `prisma db push` will silently no-op. **Pattern:** every migration that drops/renames a column must be paired with a `schema.prisma` update in the same PR.

### Theme 4: Dead validator code
`lib/validators/admin.ts` exists, has 6 schemas, and is **imported by zero routes**. The 2026-08-01 audit flagged this; the 2026-08-03 audit confirms it. **Pattern:** write the test that uses a validator, or delete the validator.

### Theme 5: UI controls that don't reflect server-side state
`MaintenanceModeScreen` and `SystemSettingsScreen` show the toggle but the server returns 403. The admin sees a "Forbidden" toast with no indication of why. **Pattern:** the UI should show a "this feature is unavailable" message if the GET detects the user doesn't have the required permission.

---

## What the 2026-08-01 deep audits got wrong (corrections)

1. **"Lighthouse-CI runs on both push and PR"** (Infrastructure #12) — **STALE (not a bug)**: the push trigger is intentional.
2. **"`cache.ts` LRU `get()` doesn't re-insert"** (Backend #11) — **STALE (audit wrong)**: `cache.ts:67-69` re-inserts the EXISTING entry, preserving `expiresAt` and `createdAt`. The audit claim was incorrect.
3. **"`choose_plan_screen` uses query-param riderId"** (Rider app original N1) — **STALE**: the file reads from the session, not the query param.
4. **"Pass 4 of AUDIT_VERIFICATION_*.md was correct"** — reclassified in API audit: 3 of 4 "STALE" labels were masking real bugs (carry-overs #6, #9, #10).
5. **"BackgroundJobsScreen.tsx:160 'Run now' double-click"** (Admin N1) — **STALE**: R3 split added `disabled={anyJobRunning}` at `JobCard.tsx:79` and `useBackgroundJobs` sets/clears `runningJobId` correctly.
6. **"IncidentDetailSheet.tsx:85 severity change no audit log"** (Admin N2) — **STALE**: `updateIncidentSchema` doesn't include `severity`; UI only **displays** severity as a badge at `IncidentDetailSheet.tsx:98`. No mutation possible.
7. **"RiderDetailDialog.tsx Reset Password button calls non-existent route"** (Admin N3) — **STALE**: no "Reset Password" button exists in any file under `web/src/components/admin/screens/rider-management/`. Last refactor `c581023` removed the entire section. The audit's `Test-Path = False` verification was correct, but the button it claimed is calling 404 doesn't exist.
8. **"vehicle_photos_screen.dart submitVehicleReturn not called"** (Rider N2) — **STALE**: both `end_rental_screen.dart:141` AND `dashboard_sheets.dart:628` call `submitVehicleReturn`.
9. **"AuditLog has no @@index([entity, entityId])"** (Database N3) — **STALE**: `web/prisma/schema.prisma:620` already declares `@@index([entity, entityId])` along with `@@index([entity, entityId, action])`. The audit was wrong on the current state.
10. **"Align schema.prisma with 2026-08-06 migrations is a single-PR fix"** (Database N1 / PR-71) — **PARTIAL / BLOCKED**: the schema change is correct, but 28 typecheck errors and ~10 silent runtime writes mean the TS code was never migrated. The audit N1 assumed the typecheck was the safety net, but the codebase has fine-grained `RiderLifecycleStatus` (15 values) that doesn't map cleanly to the 5-value `RiderLifecycleStage` enum. PR-71 needs a value-mapping shim (BEFORE INSERT trigger or value-mapping helper) before it can ship safely.
11. **"Wire lib/validators/admin.ts into 6 listed routes"** (API N1 / PR-26) — **STALE on route list**: the audit listed `admin/admins`, `admin/feature-flags`, `admin/faqs`, `admin/legal`, `admin/settings`, `admin/system-settings` but the file's 6 schemas are actually for `dataDeletionRequest/Approve/Reject/Restore`, `adminRiderUpdate`, `adminWalletAdjust`. The fix correctly wired all 6 existing schemas AND added 8 new schemas for the routes the audit named (14 total). The 41 raw-button count (Admin N7 / PR-29a) was similarly inflated — the real count was 11 in 10 files.

**Net:** the 2026-08-01 audits are ~95% accurate. The 5% error rate is concentrated in stale-feature claims and one wrong technical claim about the LRU cache. The 8/03 admin panel audit re-introduced two of the same stale-claim patterns (N1 "Run now" double-click and N2 "severity change" audit) plus one new one (N3 "Reset Password" button). The 8/03 database audit also re-introduced one stale-claim pattern (N3 "no AuditLog composite index"). The 8/03 admin panel audit re-introduced the "41 raw buttons" inflated count (actual: 11). The 8/03 design audit re-introduced the "22 screens with bg-slate-50" inflated count (actual: 4 in 3 files). The 8/03 admin N8 "add x-request-id" and design N4 "next-themes defaultTheme" are stale (both already shipped in prior sessions). The 8/03 admin N8 surfaced an adjacent real bug: the existing `x-request-id` header could be clobbered by caller-supplied `FetchOptions.headers` due to a spread-order bug — commit `1f3b63c` (PR-41) fixed that alongside, so the commit is a net positive even though the audit's headline claim was stale.

**16 reclassifications total** as of 2026-08-03 EOD:
1. Rider N1 query-param riderId (file reads from session)
2. cache.ts LRU `get()` doesn't re-insert
3. BackgroundJobsScreen "Run now" double-click (R3 split had it)
4. IncidentDetailSheet severity change (schema doesn't allow)
5. RiderDetailDialog "Reset Password" button (refactor removed it)
6. vehicle_photos_screen submitVehicleReturn not called (it IS called)
7. AuditLog has no @@index([entity, entityId]) (already exists)
8. Align schema.prisma with 2026-08-06 is a single-PR fix (needs value-mapping shim)
9. Wire 6 listed routes with admin validators (file's 6 schemas were different)
10. Migrate 41 raw <button> tags (actual: 11)
11. Replace bg-slate-50 / bg-gray-50 in 22 admin screens (actual: 4 in 3 files)
12. Add x-request-id to adminApi (already in admin-api.ts:104,112; commit `1f3b63c` fixed adjacent headers-spread bug)
13. Add `defaultTheme="system" enableSystem` to next-themes (already on providers.tsx:36)
14. Guard WorkflowCoverageScreen with `NODE_ENV` (already present, uses `APP_ENV`)

---

## Recommended ship order (24 single-file P0s, ~1-2 weeks of work)

1. **PR-55** (5 LOC): `session.role` → `hasPermission()` in maintenance-mode + system-settings. Fixes 2 dead admin features.
2. **PR-56** (20 LOC): `x-admin-id` → `session.adminId` in 5 admin files. Restores audit-log non-repudiation.
3. **PR-57** (30 LOC): `data-deletion/route.ts` — add `createAuditLog`, replace `Math.random()`. Real PII destruction surface.
4. **PR-58** (10 LOC): `admin/jobs` POST — add `requirePermission('jobs:run')`. Close the privilege hole.
5. **PR-59** (1 LOC): `globals.css` `--primary: var(--color-vf-primary);`. Fixes brand drift.
6. **PR-60** (5 LOC): `get-session.ts:117,147` — `NODE_ENV` → `APP_ENV`. Close impersonation leak in misconfigured staging.
7. **PR-61** (5 LOC): `cron-auth.ts:35` — add length check to `timingSafeEqual`. Close 500-on-short-secret.
8. **PR-62** (3 LOC): `flutter/lib/theme/app_colors.dart` — add `warningForeground` + fix contrast. WCAG AA.
9. **PR-63** (10 LOC): `BackgroundJobsScreen.tsx:160` — `disabled={isPending}`. Close double-click.
10. **PR-64** (5 LOC): `IncidentDetailSheet.tsx:85` — call `createAuditLog` in `incident.use-cases.ts:updateSeverity()`.
11. **PR-65** (2 LOC): `RiderDetailDialog.tsx` — hide "Reset Password" button.
12. **PR-66** (30 LOC): `vehicle_photos_screen.dart` — parallel uploads + progress.
13. **PR-67** (20 LOC): `vehicle_photos_screen.dart` — call `rentalUseCases.submitVehicleReturn`.
14. **PR-68** (1 + 30 LOC): `ci-cd.yml` — `--max-warnings 0`; resolve 9 pre-existing warnings.
15. **PR-69** (4 LOC): `ecosystem.config.js` — `max_memory_restart: '1G'`.
16. **PR-70** (5 LOC): `schema.prisma` `AuditLog` — add `@@index([entity, entityId])`.
17. **PR-71** (30 LOC): align `schema.prisma` with 2026-08-06 migrations.
18. **PR-72** (50 LOC): verify `cache_indexes_v2` SQL vs schema `@@index` declarations.
19. **PR-73** (30 LOC): wire 9 surface tokens to `ThemeData.colorScheme` in `app_theme.dart`.
20. **PR-74** (10 LOC): `wallet-reconciliation.job.ts` — verify column references.
21. **PR-75** (80 LOC): separate `JobQueue` for interactive vs background jobs.

**Total: 21 PRs, ~400 LOC of code changes, ~50 new tests, ~3 days of work for one engineer (or 1.5 days of focused review-ready PRs).**

The 5 remaining Tier-2 multi-file P0s (24-29 in the table) are 2-3 weeks of additional work.

---

## What was deliberately out of scope

- **Lighthouse, Playwright, k6 load tests**: not deep-audited (out of scope per request)
- **Cloudflare tunnel config**: not deep-audited
- **Secret rotation procedure**: assumed correct (`docs/SECRET_ROTATION.md` exists)
- **Production deployment / laptop-service**: assumed covered by `docs/LAPTOP_SERVICE_*`
- **External services** (Razorpay, Firebase, PostHog, Sentry): not in scope
- **Compliance / legal** (PCI-DSS, Aadhaar storage): not in scope; PII_POLICY.md exists

---

## Audit reliability

Each of the 8 audits re-verified its prior P0 claims against current code on 2026-08-03 with explicit `file:line` evidence. Stale items cite the absent file/feature. New findings are derived from the same re-read; each has a `file:line` cite, a concrete impact, and a fix.

**The 8 audits are independent** — the cross-references between them (e.g. "API N3 = Backend N11 = the chokepoint") are noted in each file. The Rider app audit's "see API audit N3" line is intentional — the same underlying issue surfaces in multiple scopes.

**No code changes made** — audit only.


## Phase 6 reclassification #39 (2026-08-04 11:15)

**Backend S2** — iles.use-cases._generateUploadToken and _verifyUploadToken previously reused env.JWT_SECRET (a hygiene issue with no current exploit, filed as FOLLOWUP_TICKETS). **Shipped today as PR-95 on ix/phase6d-api-hardening (commit e075a91)**: new env var FILE_UPLOAD_SECRET is required in production; falls back to JWT_SECRET only in dev/test. New unit test at 	ests/unit/files/upload-token-secret.test.ts asserts the right key is used in each case. The deep-audit finding is now FIXED.

## Phase 7A reclassifications #40-#44 (2026-08-04)

The Phase 6 plan listed 19 PRs across 6 sub-phases; 6A/6D/6E/6F shipped (14 PRs) but 6B (4 P0s) and 6C did not. Phase 7A ships all 4 P0s that gate the 2026-08-06 staging soak.

### Reclassification #40 — DB-M-1 (DB audit 2.8) — STALE on first pass, REAL after re-verification

The original 20260730150000_add_rider_lifecycle_stage migration was filed in Phase 6 as "shipped, just needs migration history reconciliation". After live-DB inspection on 2026-08-04 via web/scripts/inspect-migrations.ts:
- 
iders.lifecycleStage column EXISTS (data_type USER-DEFINED)
- RiderLifecycleStage enum EXISTS in pg_type
- BUT _prisma_migrations only has 1 row ( _init); 33 migrations are "not applied" from migrate status POV

This means the schema DDL applied (probably via prisma db push) but the migration history is missing. The gated 20260806020000_drop_rider_legacy_lifecycle_status hard-aborts on any DB where lifecycleStage is NULL.

**Shipped today as PR-96 on fix/phase6d-api-hardening (commit f594a6b)**:
- New migration 20260807000001_idempotent_lifecycle_stage_backfill/migration.sql — re-runnable with IF NOT EXISTS guards, IF EXISTS guards, BEGIN/EXCEPTION isolation; backfills lifecycleStage from lifecycleStatus with the 15→5 mapping
- New scripts/resolve-migration-history.ts — marks all 30 pre-gate migrations as applied via direct SQL (in a BEGIN/COMMIT/ROLLBACK transaction); EXCLUDES the 3 gated staging-soak drops
- New 	ests/unit/resolve-migration-history.test.ts (10 tests)

Verification: 32/34 migrations in _prisma_migrations (was 1 before). prisma migrate deploy will now apply the 3 gated drops cleanly.

### Reclassification #41 — DB-C-1 (DB audit 2.8) — STALE on first pass, REAL after re-verification

Filed in Phase 6 as "CHECK constraints were added; just need idempotency". After live-DB inspection on 2026-08-04 via web/scripts/inspect-constraints.ts:
- **0 of 12 expected CHECK constraints present in pg_constraint**

Root cause: the original 20260729160000_add_check_constraints/migration.sql targeted PascalCase tables ("Rider", "KycProfile") that no longer existed after 20260712000002_standardize_table_naming renamed them to snake_case. The DO \$\$ block's ALTER TABLE statements all failed with "relation Rider does not exist" and the migration was never marked applied.

**Shipped today as PR-97 on fix/phase6d-api-hardening (commit 572c940)**:
- New migration 20260807000000_add_check_constraints_corrected/migration.sql — uses snake_case tables, adds 12 constraints (original 11 + wallet_deposit_nonnegative), wraps each in BEGIN/EXCEPTION for partial-failure isolation
- New scripts/apply-check-constraints.ts — verify the migration applies + re-runs cleanly
- New 	ests/unit/check-constraints-corrected.test.ts (8 tests)

Verification: 12/12 CHECK constraints present in both public + test schemas (was 0/12 before). The 
ider_battery_level_range constraint now correctly rejects batteryLevel=999 with SQLSTATE 23514.

### Reclassification #42 — DB-CL-1 (DB audit 2.8) — SHIPPED

The offline mock fallback (process.env.DATABASE_OFFLINE=true) in web/src/lib/db.ts was a development convenience that created a real production risk: misconfigured env var → silent mock data (10 hardcoded phones, auto-approved KYC, ₹1000 balance, ₹5000 deposit). The 16+ reads of process.env.DATABASE_OFFLINE short-circuited ALL Prisma queries to mock data, bypassing the error path entirely.

**Shipped today as PR-98 on fix/phase6d-api-hardening (commit efae83d)**:
- web/src/lib/db.ts — removed isDbOffline, startRecoveryCheck, mockRiderPhoneMap, EXISTING_PHONES, EXISTING_IDS, getMockFallback; cleaned 412 → 175 lines
- web/src/lib/env.ts — removed the production guard (no longer needed)
- web/src/lib/shell.ts — removed DATABASE_OFFLINE short-circuits in dumpDatabase + 
estoreDatabase
- 14 test files — removed dead process.env.DATABASE_OFFLINE = 'false' lines
- 	ests/global-setup.ts — removed the orce DATABASE_OFFLINE=false step
- New scripts/check-no-database-offline.sh — CI guard that fails the build on any web/src/ reference
- New 	ests/unit/check-no-database-offline.test.ts (3 tests)

Verification: 0 process.env.DATABASE_OFFLINE references in web/src/ (was 16+). 2081 unit tests pass after the mock removal (was 2053; +28 new from PR-96/97/98). Pre-existing 3 daily-engagement failures now surface (they were previously hidden by the mock returning empty data).

### Reclassification #43 — SEC-N-0 (Security audit) — SHIPPED

3 of 7 security-event loggers were already wired (Phase 6 work). 4 still had 0 callers: logPermissionDenied, logKycDocumentView, logAccountSuspension, logReconciliationMismatch. This is a SOC2/GDPR gap: every security-relevant action should be in the audit log.

**Shipped today as PR-99 on fix/phase6d-api-hardening (commit 4a605a5)**:
- New dminForbiddenWithLog({session, permission, route, ip}) helper in lib/rbac.ts that wraps errors.forbidden() and fires logPermissionDenied (fire-and-forget)
- kycRepository.findByRiderIdForAdmin(riderDbId, {adminId}) for admin KYC document access; fires logKycDocumentView
- In dminRiderUseCases.update(), when KYC REJECTED → lifecycleStatus=SUSPENDED, fire logAccountSuspension
- In 
unWalletReconciliation() per-wallet loop, when integrity.drift != 0, fire logReconciliationMismatch
- New 	ests/unit/security-events-wiring.test.ts (10 tests)

Verification: 4/4 security-event loggers wired (was 0/4). All wiring calls fire-and-forget so the response is not delayed by audit-log writes.

### Reclassification #44 — INF-CI/CD-3 (Infrastructure audit) — VERIFIED + HARDENED

Phase 6F (PR-94) shipped scripts/check-secret-rotation.ts and wired .github/workflows/secret-rotation-nightly.yml to call it. The script has an explicit main() function, calls process.exit(outcome.exitCode), and the test asserts exit code 0 on clean + exit code 1 on stale.

**Hardened today as PR-100 on fix/phase6d-api-hardening (commit 07c7927)**:
- New 	ests/unit/check-secret-rotation-nightly.test.ts (10 tests) — regression guards that catch any future refactor that drops the wiring (main() function, workflow cron schedule, webhook call, test coverage of exit codes)

Verification: secret-rotation nightly CI is fully wired and regression-protected.

### Cumulative reclassifications

- Phase 6 re-verification: 38 reclassifications (#1-#38)
- Phase 6 ship session: #39 (Backend S2)
- Phase 7A ship session: #40-#44 (DB-M-1, DB-C-1, DB-CL-1, SEC-N-0, INF-CI/CD-3)
- **Total: 44 reclassifications** across 2 ship sessions + 1 re-verification

### Staging soak gate status (2026-08-04)

All 4 P0s from AUDIT_PHASE6_PLAN_2026-08-04.md (DB-M-1, DB-C-1, DB-CL-1, INF-CI/CD-3) are now SHIPPED. The 3 gated drop migrations (20260806000000, 20260806010000, 20260806020000) are ready to run on staging. **The 2026-08-06 staging soak is unblocked.**

## Phase 7B-7H reclassifications #45-#70 (2026-08-04)

Phase 7B-7H landed 26 PRs across 7 sub-phases (parallel agents hit the local token-plan limit mid-flight; the working-tree edits were extracted and committed). Reclassifications #45-#70 cover the shipped work.

### Reclassification #45 — B-A1 (Backend audit 1.1) — VERIFIED
PR-101 confirmed nalytics.use-cases.ts:97-110 filters to 	ype='DEBIT' AND purpose='RENT_PAYMENT'. No code change; 1 regression test added.

### Reclassification #46 — B-RF1 (Backend audit 1.5) — SHIPPED
PR-102 collapsed two referral-reward implementations. The use-case path and the job path now share the same paise value (no * 100 double-conversion) and the same 
eferral:{referrerId}:{refereeId} idempotencyKey. The DB UNIQUE constraint on WalletLedger.idempotencyKey is the authoritative arbiter.

### Reclassification #47 — B-J2 (Backend audit 1.7) — SHIPPED
PR-107 set ttempts=0 in the reaper reclaim UPDATE. A legitimately slow job can now survive the reaper-reclaim cycle without dying on max-attempts.

### Reclassification #48 — B-J3 (Backend audit 1.7) — PARTIAL
PR-108 shipped the istDateKey() helper. Migration of the 3 daily jobs (audit-cleanup, telemetry-cleanup, daily-engagement) is a follow-up because each needs a separate careful look at its current idempotency story.

### Reclassification #49 — B-J4 (Backend audit 1.7) — SHIPPED
PR-109 added a daily outbox-completed-cleanup scheduled task. Outbox table is now bounded.

### Reclassification #50 — B-A2 (Backend audit 1.1) — SHIPPED
PR-110 rewrote getCohortData as a single db. with TO_CHAR() GROUP BY + COUNT(*) FILTER. No more full-rider-table load into Node memory.

### Reclassification #51 — SEC PR-3 (Security audit 2.1) — SHIPPED
PR-111 moved the dev OTP '111111' check to the LAST gate in erifyOtp (after entry/verified/expiry/attempts). 182 lines of regression test.

### Reclassification #52 — SEC PR-5 (Security audit 2.1) — SHIPPED
PR-112 replaced process.env.NODE_ENV with the canonical APP_ENV in 5 security-sensitive files (auth.ts, middleware.ts, rate-limit.ts, otp-store.ts, auth.use-cases.ts). A misconfigured prod with APP_ENV=staging now gets the production security posture. PR-112b added the CI guard for future regression prevention.

### Reclassification #53 — SEC PR-6 (Security audit 2.1) — SHIPPED
PR-113 used crypto.timingSafeEqual for OTP code compare (padded to 6 bytes). Constant-time compare closes the timing side-channel.

### Reclassification #54 — SEC PR-9 (Security audit 2.1) — SHIPPED
PR-116 closed two findings: (a) sendOtp no longer returns exists (user-enumeration); (b) erifyOtp blocks self-referral (the rider's own 
eferralCode is rejected as the incoming referral). 3 regression tests.

### Reclassification #55 — SEC PR-11 (Security audit 2.1) — SHIPPED
PR-117 normalized PII key matching in pii-redact.ts (strips -, _, whitespace + substring match). Keys like userRiderAadhaarNumber are now redacted.

### Reclassification #56 — DB-IX-1 (DB audit 2.8) — SHIPPED
PR-120 added 5 covering indexes for hot query paths. Each verified by reading the source code that issued the query.

### Reclassification #57 — DB-IX-2 (DB audit 2.8) — SHIPPED
PR-121 added wallet_ledgers(riderId, createdAt) index (no-op because the dev DB already had it via db push).

### Reclassification #58 — DB-ENC-1 (DB audit 2.8) — SHIPPED
PR-122 enabled the pgcrypto extension.

### Reclassification #59 — DB-ENC-2 (DB audit 2.8) — SHIPPED
PR-123 shipped multi-version PII key support + 
otate-pii-key.ts + migrate-legacy-pii.ts + 8 tests. Operators can now rotate the PII key without invalidating existing ciphertext.

### Reclassification #60 — DB-DEL-1 (DB audit 2.8) — SHIPPED (docs)
PR-124 documented the GDPR data retention strategy as Anonymize-in-Place in docs/GDPR_DELETE_DECISION.md.

### Reclassification #61 — DB-IX-3 (DB audit 2.8) — SHIPPED
PR-127 replaced stale lifecycleStatus/	eamLeader indexes in schema.prisma with FK-column indexes (pickupHubId, currentPlanId, teamLeaderId, createdAt).

### Reclassification #62 — AP-F-1 (Admin audit 4.1) — VERIFIED
PR-135 confirmed data-management/index.tsx is 82 lines (orphan status from Phase 4 resolved).

### Reclassification #63 — AP-F-2 (Admin audit 4.1) — SHIPPED
PR-136 created 7 thin route segments under /admin/data-management/* so each section has a bookmarkable URL.

### Reclassification #64 — AP-F-3 (Admin audit 4.1) — VERIFIED (review-only)
PR-137 was a focused review of Restore/DR tabs; no code change. Review report is in the commit message.

### Reclassification #65 — AP-F-4 (Admin audit 4.1) — SHIPPED
PR-138 added the useCanRestore() hook + read-only banner in RestoreTab + DR Tab. Destructive controls are now disabled when the admin lacks the data_management_restore permission.

### Reclassification #66 — INF-CI/CD-4 (Infra audit 5.2) — SHIPPED
PR-139 added the scripts/check-secret-rotation.sh wrapper. The CI step at ci-cd.yml:162-163 no longer references a dead file.

### Reclassification #67 — INF-CI/CD-6 (Infra audit 5.2) — SHIPPED
PR-140 removed -ErrorAction SilentlyContinue from e2e-windows.yml ALTER USER. CI now fails loudly on DB password setup.

### Reclassification #68 — INF-CI/CD-7 (Infra audit 5.2) — SHIPPED
PR-141 added 
etention-days: 7 to lutter-ci-cd.yml build-debug artifact. ~13x cost reduction.

### Reclassification #69 — INF-OBS-1 (Infra audit 5.2) — SHIPPED
PR-142 wired scripts/setup-logrotate.sh into ootstrap.sh so logrotate actually runs on first deploy.

### Reclassification #70 — DS-T-4 + T-5 (Design audit 3.1) — PARTIAL
PR-125 added the back-compat note on AppColors.onSurfaceMuted. Full 19-tier token regen is deferred until the lint ratchet (PR-126) ships.

### Cumulative reclassifications

- Phase 6 re-verification: 38 reclassifications (#1-#38)
- Phase 6 ship session: #39 (Backend S2)
- Phase 7A ship session: #40-#44 (DB-M-1, DB-C-1, DB-CL-1, SEC-N-0, INF-CI/CD-3)
- Phase 7B-7H ship session: #45-#70 (26 PRs across 7 sub-phases)
- **Total: 70 reclassifications** across 3 ship sessions + 1 re-verification

### Final ship state (2026-08-04)

- Phase 1-5: 38 PRs (deep audit fixes)
- Phase 6: 14 PRs (6A/6D/6E/6F)
- Phase 6 follow-up: 1 PR (PR-95 Backend S2)
- Phase 7A: 5 PRs (5 P0s that gate staging soak)
- Phase 7B-7H: 26 PRs (across 7 sub-phases)
- **Total: 84 PRs + 1 BOM-strip chore + 4 docs commits** on ix/phase6d-api-hardening

**The 2026-08-06 staging soak is fully unblocked.** The 3 gated drop migrations (20260806000000, 20260806010000, 20260806020000) are ready to run on staging.

## Polish-batch reclassifications #71-#79 (2026-08-04)

After Phase 7B-7H shipped, 11 follow-up PRs landed to close the polish
batch: 4 P0 follow-ups (APP_ENV guard, istDateKey migration) plus 7
design/rider/infra polish items.

### Reclassification #71 — INF-OBS-3 (Infra audit 5.2) — SHIPPED (docs)
PR-143 shipped docs/EXTERNAL_UPTIME.md with UptimeRobot + cron-job.org
setup instructions for probing https://api-staging.../api/health.
External probe catches tunnel-down events within 5 min.

### Reclassification #72 — INF-RISK-1 (Infra audit 5.2) — SHIPPED (docs)
PR-144 appended a "Known limitations" section to
docs/DISASTER_RECOVERY.md documenting: untested DR procedure,
undocumented secret escrow, single-laptop SPOF.

### Reclassification #73 — INF-DEP-1 (Infra audit 5.2) — SHIPPED
PR-145 added metrics: localhost:2000 to cloudflared-config.example.yml
+ docs/CLOUDFLARE_TUNNEL_HEALTH.md (Prometheus + blackbox + PM2 config).

### Reclassification #74 — DS-DM-1 (Design audit 3.1) — SHIPPED (ratchet)
PR-128 added lutter/scripts/check-colors-ratchet.sh. 581
Colors.white|black uses outside lib/theme/ recorded as baseline;
ratchet prevents growth.

### Reclassification #75 — DS-DM-2 (Design audit 3.1) — SHIPPED
PR-128 added explicit shimmerBaseDark / shimmerHighlightDark tokens
in pp_theme.dart:194-195 (slate-800 / slate-700) + 5 tests asserting
brightness pair correctness.

### Reclassification #76 — RA-F-2 (Rider audit 6.1) — SHIPPED
PR-130 deleted lib/features/auth/widgets/otp_timer.dart (209 lines
of OTPTimer + AnimatedOTPTimer dead code). OtpResendWidget +
parent's _resendCountdown is the canonical answer.

### Reclassification #77 — RA-F-6 (Rider audit 6.1) — SHIPPED (ratchet)
PR-134 added lutter/scripts/check-screen-size.sh. 10 screens
currently over 600 lines recorded as baseline; ratchet prevents growth.
Actual splits into widgets/ folders are follow-up PRs (PR-134a through
PR-134e).

### Reclassification #78 — DS-C-3 (Design audit 3.1) — SHIPPED
PR-127 deleted card_parallax_tilt.dart (29-line wrapper duplicate
of TiltCard). Moved cards.dart to lib/widgets/cards/cards.dart
with re-export shim at the old path.

### Reclassification #79 — RA-F-4 (Rider audit 6.1) — SHIPPED
PR-132 added lib/utils/image_decode.dart with decodeImageWithCap
helper. instantiateImageCodec(targetWidth: 2048) downscales during
decode (12MP → 2MP, ~9x RAM savings).

### Plus 2 P0 follow-ups (continuing the 7A/7B-7H ledger):

- **PR-108b** (B-J3 follow-up): 3 daily jobs migrated to
  istDateKey helper. 06:00 IST run no longer straddles the
  UTC/IST boundary.
- **PR-112c** (SEC PR-5 follow-up): 5 raw process.env.NODE_ENV
  reads fixed in pi-middleware.ts, db.ts, logger.ts. The
  new CI guard scripts/check-no-node-env-security.sh is green.

## Post-Phase 7 audit-pass reclassifications #82-#83 (2026-08-04)

A live-tree audit pass after the polish batch shipped caught 5 false
positives (api-handler instanceof check, device-route guard asymmetry,
admin folder structure) and 2 real issues that needed their own
follow-up PRs:

### Reclassification #82 — B-W1 (Backend audit 2.3) — SHIPPED

PR-115 wired `notificationsCleanupJob.process` into `WORKERS[]` in
`web/src/server/workers/index.ts`. The job file existed and the admin
"Run now" button advertised it as "Weekly (Sun 03:00 IST)" but no
worker consumed the `OutboxEventTypes.ADMIN_JOB_NOTIFICATIONS_CLEANUP`
event — admin clicks would have stranded events in the outbox until
the daily cleanup task purged them. New entry at `priority: 'background'`
(interactive per-event notification dispatch takes precedence per the
PR-75 priority split). 5-test regression guard in
`web/tests/unit/workers/notifications-cleanup-worker-registered.test.ts`.

### Reclassification #83 — DS-TY-3 (Design audit 3.1) — SHIPPED (ratchet)

PR-114 added `flutter/tool/lint_google_fonts_bypass.dart` to count
widget-side `GoogleFonts.plusJakartaSans(...)` calls in `lib/`
(excluding `lib/theme/app_theme.dart`). Ceiling pinned at 307 (the
actual measured count, not the 20 originally reported). This is the
same ratchet pattern as PR-126 (typography), PR-128 (colors), PR-134
(screen size), and PR-142 (touch targets) — token discipline without
bulk migration. 6-test regression guard in
`flutter/test/tools/lint_google_fonts_bypass_test.dart` (live subprocess
test is skipped on sandboxes where `dart` isn't on PATH for the test
process).

### Final Phase 7 reclassification ledger

- Phase 6 re-verification: 38 reclassifications (#1-#38)
- Phase 6 ship session: #39 (Backend S2)
- Phase 7A ship session: #40-#44 (5 P0s)
- Phase 7B-7H ship session: #45-#70 (26 PRs)
- Polish batch ship session: #71-#79 (11 PRs) + 2 P0 follow-ups
- Post-Phase 7 audit pass: #82-#83 (PR-115, PR-114)
- **Total: 83 reclassifications** across 5 ship sessions + 1 re-verification + 1 audit pass

### Final cumulative state (2026-08-04 end-of-day)

- Phase 1-5: 38 PRs (deep audit fixes)
- Phase 6: 14 PRs (6A/6D/6E/6F)
- Phase 6 follow-up: 1 PR (PR-95 Backend S2)
- Phase 7A: 5 PRs
- Phase 7B-7H: 26 PRs
- Polish batch: 11 PRs
- Post-Phase 7 audit pass: 2 PRs (PR-115 worker wiring, PR-114 GoogleFonts ratchet)
- Docs commits: 5
- **Total: 97 PRs + 5 docs commits** on fix/phase6d-api-hardening

**The 2026-08-06 staging soak is fully unblocked and ratchet-protected.**
The 3 gated drop migrations are ready to run on staging. The
APP_ENV, NODE_ENV, DATABASE_OFFLINE, fontSize, GoogleFonts,
Colors.white, screen-size, and touch-target ratchets are all in place
to prevent drift going forward.

### Reclassification #84-#93 — 2026-08-06 fix-plan still-true audits (10 PRs)

Executed per `docs/plans/2026-08-06-fix-plan-still-true-audits.md`
(verified against current source before writing; several "likely still true"
items were already fixed by prior passes and are NOT reclassified here).

- #84 — PR-4a/4b — `?page=abc` NaN → Prisma skip/take. `parsePositiveInt`
  helper in `web/src/lib/api-utils.ts`; applied to 19 paginated routes
  (admin earnings/transactions/admins/audit-logs/incidents/tickets/
  notifications/rewards/team-leaders/riders/deposits/faqs/announcements/
  guarantors/rentals/kyc/scores, rider/earnings, transaction/history).
- #85 — PR-1 — dead `server/modules/admin/admin.routes.ts` removed;
  `PasswordComplexitySchema` enforced in `createAdminSchema` +
  `adminLoginSchema` (verified present; no rework needed).
- #86 — PR-2 — dead `getDashboard()` in analytics.use-cases removed (already).
- #87 — PR-9 — `activeRentals`/`activeRiders` labels distinct; lifecycle
  rank consolidated in `web/src/lib/lifecycle-ranks.ts` (already).
- #88 — PR-6 — `/api/rider/offers` route deleted (Path B), openapi entry +
  flutter `getRiderOffers` client method removed; redeem-reward feature
  deferred → FOLLOWUP_TICKETS.
- #89 — PR-3 — 4 PII fields stripped from rider dashboard + N+1 vehicle
  query folded (already).
- #90 — PR-8 — ReferralScreen no longer renders fake `VOLTIUM-XXXX`;
  nullable code resolved from rider cache else singular
  `GET /api/rider/referral`, skeleton + retry while unresolved.
- #91 — PR-5 — Flutter `postRiderDeviceVerifyLock` wired into the locked
  overlay + settings (already).
- #92 — PR-7 — two-person data deletion completed: restore route now clears
  `deletedAt` (soft-delete middleware was hiding restored riders),
  `?deleted=true` list filter, `data-deletion-purge.job.ts` hard-anonymizes
  PII past the 7-day window (Rider/KycProfile/Guarantor) with
  `RIDER_DATA_DELETION_PURGED` audit record, wired into workers registry.
- #93 — PR-8 test gates + PR-4b/PR-6/PR-7 gates: `api-utils.test.ts`,
  `admin-riders-list-deleted.test.ts`, `data-deletion-purge.test.ts`,
  updated `data-deletion-flow.test.ts` (restore clears deletedAt), flutter
  referral-screen behavioral tests (no placeholder, retry, real code),
  regenerated `referralscreen_golden.png`.
- #94 — PR-7 (DR restore orphan) — `restore.service.ts` tracks the
  pre-restore backup id; on a mid-restore failure it flags the backup
  `ORPHANED_BY_FAILED_RESTORE:<restoreJobId>` and emits
  `restore.orphaned_pre_restore_backup` audit entry. New
  `orphan-backup-cleanup.job.ts` purges flagged PRE_RESTORE backups past the
  7-day operator-acknowledgement window (disk + row + `backup.orphan_purged`
  audit), registered in the workers SCHEDULED_TASKS. Gates:
  `restore-orphaned-pre-restore.test.ts`, `orphan-backup-cleanup.test.ts`.
- #95 — PR-8 (credentials at rest) — payment-gateway `keySecret` and
  `webhookSecret` are now AES-256-GCM encrypted at rest via the new
  `lib/credentials.ts` (idempotent encrypt — the edit dialog round-trips the
  decrypted value without double-encryption; legacy plaintext rows decrypt
  through untouched). Wired into POST/PATCH/GET for both
  `/api/admin/payment-gateways` routes. Gate:
  `credentials-roundtrip.test.ts` (store→read-back, no double-encrypt,
  legacy passthrough).
- #96 — PR-4 (announcements async) — `POST /api/admin/announcements` no
  longer fans out to 10k+ riders in a request transaction. Immediate ALL
  sends require `?confirm=true` + 3/hr/admin fail-closed rate limit and
  return 202; the use-case emits `ANNOUNCEMENT_BROADCAST` outbox events and
  the new `announcement-broadcast.job.ts` re-derives recipients and runs the
  batched insert (500/batch, 100ms throttle, `skipDuplicates` idempotency)
  in the background. Scheduled announcements: the cron now emits events
  instead of inline fanout. Admin Bulk Messaging UI added the confirm gate
  + `?confirm=true` for immediate ALL. Gates:
  `announcements-async-broadcast.test.ts` (7 tests).
- #97 — 2026-08-07 verification sweep (Section 2 still-open items) — PR-1
  backend: `todayStats` TODO comment (distance/power/speed debt visible);
  verified dashboard PII already stripped + N+1 vehicle join + two-person
  rule + ASSIGN_PLAN dedup + async backup outbox + DEVICE_VIOLATION
  maxAttempts=3 + settings_manage doc + rewards PUT already landed. PR-2
  admin UI: KycDetailSheet PII masked behind `showPii` toggle (gated on
  `kyc_approve`), PaymentGatewayEditDialog/Card secret masking, vehicles
  "retired" terminology, `useServerHealth` caddyStatus normalization,
  maintenance-mode message save split into PATCH (toggle no longer wipes
  message). PR-3 Flutter: delete-account dialog now POSTs the new
  `/api/rider/account/delete-request` route (session-gated, Zod-validated,
  writes `deletionRequestedAt`/`deletionRequestReason` + RIDER_DELETION_REQUESTED
  audit log) instead of a silent no-op; logout clears the nav stack to
  AppShell; edit_profile drops the redundant `name` key. PR-4 Flutter:
  `GET /api/rider/legal` (public, cache 300s) + legal screen renders
  API-managed docs with hardcoded offline fallback (legal gate never
  hard-blocks); `walletMaxTopup`/`autoApproveTopupLimit`/`referralBonusCap`
  added to SETTING_REGISTRY (paise defaults); plan `isActive` now drafts
  by default; bulk-reject reason guard (10-char min) on both sides;
  run-now returns 202; legal route cache=0; team-leader soft-delete;
  jobs_view perm; case-insensitive earnings search; HardwareMetricsCard
  labels verified correct. Gates: `rider-legal.test.ts` (3),
  `legal_screen_api_test.dart` (2), `notification-batch-fcm-push.test.ts` (4),
  `emergency-sos.test.ts` (6). Also restored 4 files an over-eager dead-code
  pass had deleted while still referenced (RiderRepository interface+impl,
  ProfileEntity, TopUpReceiptScreen) and prisma generate re-run for the two
  new Rider columns.
- #98 — 2026-08-07 Section 2 re-verification (7-PR sweep): 20+ tracker
  "still-open" items verified against source — ~15 already fixed
  (reclassified, no code change): wallet-deduct 100x prefill (amount is
  already rupees via paiseToRupees), analytics raw-SQL mapping + plan
  isActive (landed), offers route deleted, HardwareMetricsCard labels,
  ScheduleTab backup roots, admin legal cache, KYC Ctrl-shortcut block,
  window.open noopener, create-ticket photo picker, SOS GPS, logout
  guarantor reset, submitVehicleReturn vehicleId guard, end-rental
  onSuccess wiring. Applied fixes: dashboard `activeRentals` now counts
  ACTIVE rental leases (not vehicles); ADMIN_JOB_DAILY_ENGAGEMENT worker
  entry added (admin Run-now was a silent no-op — same class as the
  earlier ADMIN_JOB_RENT_DUE_CHECK fix); `todayStats` returns
  null+dataAvailable:false instead of misleading zeros; payment-gateway
  edit dialog never pre-populates secrets + change-only submit + cleared
  on close; maintenance banner draftable while disabled; Reward.points
  unit JSDoc; consent schema extended to 9 permission types; scheduled
  backup SystemSetting.upsert now passes required `category`
  (runtime-crash fix); stale run-now test updated 200→202. Flutter:
  lock-password tile labelled "Change"; theme follows system on first
  launch + theme_changed PostHog event; splash skips ~3s animation for
  logged-in riders; pickup hub RefreshIndicator + refresh-on-resume;
  updateRiderProfile maps full generated-model field set; permissions
  screen gates onboarding on location/camera/notifications only and
  records consent for every permission; login PostHog calls awaited;
  emergency-contact ids use microsecond+random (collision fix); mark-all
  read guarded against re-entrancy. Deferred (needs product decision):
  rewards redeem endpoint, pickup-state persistence on app kill,
  theme/locale tri-state "Follow System", earnings local-to-backend sync.
  Validation: web tsc 0 errors, 281 test files / 2797 tests green (test
  DB schema re-synced via prisma db push), flutter analyze clean, 56
  targeted Flutter tests green.
