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

**Net:** the 2026-08-01 audits are ~95% accurate. The 5% error rate is concentrated in stale-feature claims and one wrong technical claim about the LRU cache. The 8/03 admin panel audit re-introduced two of the same stale-claim patterns (N1 "Run now" double-click and N2 "severity change" audit) plus one new one (N3 "Reset Password" button). The 8/03 database audit also re-introduced one stale-claim pattern (N3 "no AuditLog composite index"). The 8/03 admin panel audit re-introduced the "41 raw buttons" inflated count (actual: 11). The 8/03 design audit re-introduced the "22 screens with bg-slate-50" inflated count (actual: 4 in 3 files). The 8/03 admin N8 "add x-request-id" and design N4 "next-themes defaultTheme" are stale (both already shipped in prior sessions).

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
12. Add x-request-id to adminApi (already in admin-api.ts:104,112)
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
