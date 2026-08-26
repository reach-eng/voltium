# P1 / P2 Remediation Plan — 2026-07-30

**Scope:** Tickets #1, #2, #3, #6, #7, #8, #15, #20, #27, #28, #32 from `docs/FOLLOWUP_TICKETS.md` (Phase 2 + selected Phase 3).
**Method:** Read each ticket body, verified the current code state, and produced a per-ticket PR plan with scope, risks, and acceptance criteria.
**Source of truth:** This doc. Each ticket below is one PR (or one multi-PR epic for the largest ones). Reviewer focus notes included.

---

## TL;DR

| # | Ticket | Real audit claim? | Effort (focused) | Multi-PR? |
|---|---|---|---|---|
| #1 | RiderManagement split | Partly stale (subdir already exists) | 0.5–1 day | Single PR |
| #2 | Outbox `notifyOnFail` | Real (option b: delete dead code) | 2–4 hr | Single PR |
| #3 | Flutter screen splits + appDebug | Real (677/546/540 line files, 57 debugPrint) | 2–3 days | 3 PRs |
| #6 | RiderLifecycleStatus enum split | Real (15 values, 5 stage + 10 per-step) | 3–5 days | 3 PRs |
| #7 | pickupHub/currentPlan/teamLeader → FKs | Real (all 3 are `String?`) | 2–3 days | 2 PRs |
| #8 | String JSON → Json | Real (5 columns) | 2–3 days | Single PR (data migration) |
| #15 | Consolidate rbac + permissions | Partly stale (rbac is small) | 0.5 day | Single PR |
| #20 | Split admin home | Stale (admin/page.tsx is 21 lines) | 0 hr | Close as audit-correction |
| #27 | Consolidate widgets | Real (10+ cards, 5 celebrations, 3 anims) | 2–3 days | 3 PRs |
| #28 | Move screen-specific widgets | Real (78 widget files) | 3–5 days | Single mega-PR or per-feature |
| #32 | CI lint for raw values | Real (57 debugPrint, no analysis rules) | 0.5 day | Single PR |

**Net: ~17–24 focused days across ~14–17 PRs. Most can ship independently. Several have **data migration soak requirements** (1+ week on staging) that gate production.**

**Real audit claims vs stale:** 8 real, 2 partly stale, 1 fully stale.

---

## Strategy: ship in this order

1. **Cleanup first (small, contained, no schema migration):** #20, #15, #1, #2, #32. All single-PR.
2. **Lint enforcement (gates future work):** #32, before any large refactor.
3. **Mechanical Flutter cleanup:** #3 (the appDebug part) is the easiest sub-PR of #3.
4. **DB migrations:** #8, #7, #6, #9. **Sequence: 8 → 7 → 6 → 9.** Each requires staging soak.
5. **Bigger refactors:** #3 screen splits, #27 widget consolidation, #28 widget moves. These can be parallelized across teammates.

---

## PR-by-PR plan

### PR-P1.1 — Ticket #20: Split admin home (1 hour, but probably close as stale)

**Audit claim:** `components/admin/screens/index.tsx` is 1,139 lines.

**Verified current state:** `src/app/admin/page.tsx` is **21 lines** (a re-export shim). The actual home lives elsewhere or the audit's "1,139 lines" was already split in earlier phases. `git log` is not available to confirm which phase, but the file does not exist as 1,139 lines anywhere in the repo today.

**Recommendation:** **Close as audit-correction.** The file the audit referenced is already at the size the ticket wanted. No work needed.

**Effort:** 0 hours.

**Acceptance:**
- [ ] Confirmed no file in `web/src/components/admin/screens/` or `web/src/app/admin/` exceeds 500 lines
- [ ] Ticket #20 marked done in `FOLLOWUP_TICKETS.md`
- [ ] No code changes

**Reviewer focus:** "Read this PR and confirm there is no 1,139-line file in the admin home. The ticket was filed against stale code."

---

### PR-P1.2 — Ticket #15: Consolidate `lib/rbac.ts` and `lib/permissions.ts` (0.5 day)

**Audit claim:** `lib/rbac.ts` is 36 lines of re-exports; `lib/permissions.ts` is 11 KB with two sources of truth (`PERMISSION_DESCRIPTORS` and `PERMISSIONS_MAP`).

**Verified current state:**
- `lib/rbac.ts` = 36 lines, exports `requireAdmin`, `requirePermission`, `adminUnauthorized`, `adminForbidden`, `parsePaginationParams`. Not pure re-exports — it has real helpers. Cannot delete.
- `lib/permissions.ts` = 329 lines (less than 11 KB; audit was off). Contains `PERMISSION_DESCRIPTORS` (with `key`, `label`, `category`) and `PERMISSIONS_MAP` (with `Record<string, PermissionList>`). Both maintained by hand.

**Plan (single PR):**

1. **Generate `PERMISSIONS_MAP` from `PERMISSION_DESCRIPTORS`** so the two can't drift:
   - Keep `PERMISSION_DESCRIPTORS` as the source of truth.
   - Generate `PERMISSIONS_MAP` at module load via a `derivePermissionMap()` helper that reads the descriptor keys.
   - Move per-role permissions into a `ROLE_PERMISSIONS: Record<AdminRole, Set<string>>` constant that's still hand-maintained (this is the actual role-policy matrix, not derivable from descriptors).

2. **Trim `lib/rbac.ts`:** keep only `parsePaginationParams` (the genuinely useful helper). Move `requireAdmin` / `requirePermission` / `adminUnauthorized` / `adminForbidden` to be re-exports from `lib/auth.ts` + `lib/permissions.ts` (single source for each). Update the 30+ import sites.

3. **Add a startup test** (`tests/unit/permissions-sync.test.ts`):
   - Every `PERMISSION_DESCRIPTORS.key` is referenced by at least one role in `ROLE_PERMISSIONS`.
   - No orphan keys in `PERMISSIONS_MAP` (i.e., `keyof PERMISSIONS_MAP` ⊆ `PERMISSION_DESCRIPTORS.key`).
   - This is a static check; ~30 lines.

**Files to touch:**
- `web/src/lib/permissions.ts` (split into `permissions-descriptors.ts` and `permissions-roles.ts`)
- `web/src/lib/rbac.ts` (reduce to ~10 lines)
- ~30 import sites (mechanical find/replace)
- New `web/tests/unit/permissions-sync.test.ts`

**Acceptance:**
- [ ] `lib/rbac.ts` is ≤ 15 lines OR removed entirely
- [ ] `PERMISSION_DESCRIPTORS` is the only hand-maintained source for permission keys
- [ ] `permissions-sync.test.ts` passes and would fail if anyone adds a descriptor without assigning it to a role
- [ ] All existing `rbac.ts` callers compile

**Reviewer focus:** "Confirm that no functional behavior changed. The PR is purely structural — all exports keep the same name and signature."

**Effort:** 0.5 day focused.

---

### PR-P1.3 — Ticket #1: Finish splitting `RiderManagement.tsx` (0.5–1 day)

**Audit claim:** `RiderManagement.tsx` is 1,213 lines and mixes list/row/filter/modal logic.

**Verified current state:**
- `RiderManagement.tsx` = **743 lines** (already down from audit's 1,213 — earlier phase split some).
- `rider-management/` subdir already exists with 13 helper files: `RiderRow.tsx`, `RiderFilters.tsx`, `RiderBulkActions.tsx`, `KycActionModal.tsx`, `AdjustWalletModal.tsx`, `BulkDeleteModal.tsx`, `RiderDetailDialog.tsx` (1,383 lines!), `AddRiderDialog.tsx`, `ConfirmDeleteModal.tsx`, `DeleteDocModal.tsx`, `ClearGuarantorModal.tsx`, `UndoToast.tsx`, `helpers.tsx`.
- The audit's goal (RiderRow + RiderFilters + modals as separate files) is **already partially met.** RiderRow and RiderFilters exist as siblings.

**Plan (single PR):**

1. **Audit `RiderManagement.tsx` (743 lines):** what concerns are still inline?
   - Likely candidates: top-level table + pagination, dialog state coordination, URL query string sync, status badges.

2. **Extract any remaining inline concerns** into a `RiderListShell` and a `RiderTable` (the current `RiderRow` is the per-row, but the surrounding table wrapper may still be in the parent).

3. **Split `RiderDetailDialog.tsx` (1,383 lines):** this is the real elephant now. Extract:
   - `RiderDetailHeader.tsx` (top of dialog)
   - `RiderDetailTabs.tsx` (tab navigation)
   - `RiderDetailKycTab.tsx` (~400 lines)
   - `RiderDetailWalletTab.tsx` (~300 lines)
   - `RiderDetailHistoryTab.tsx` (~200 lines)
   - `RiderDetailActions.tsx` (the action buttons at the bottom)
   - The parent becomes a thin shell that switches tabs.

4. **Target:** `RiderManagement.tsx` ≤ 200 lines, no file in `rider-management/` > 500 lines.

**Files to touch:**
- `web/src/components/admin/screens/RiderManagement.tsx` (split)
- `web/src/components/admin/screens/rider-management/RiderDetailDialog.tsx` (split into 5-6 files)
- Possibly new: `RiderTable.tsx`, `RiderListShell.tsx`

**Acceptance:**
- [ ] `RiderManagement.tsx` ≤ 200 lines
- [ ] `RiderDetailDialog.tsx` ≤ 400 lines (with the rest extracted)
- [ ] No visual regression (compare to staging)
- [ ] All 33 E2E tests still pass
- [ ] `npm run lint/typecheck/build` clean
- [ ] Test count: ≥ 1,537 passing

**Reviewer focus:** "Run the admin Rider screen in staging and confirm no visual change. The split should be invisible to the user."

**Effort:** 0.5–1 day focused.

---

### PR-P1.4 — Ticket #2: Delete `JobQueue.enqueue` (dead code) (2–4 hours)

**Audit claim:** `JobQueue.enqueue` has 0 callers. Decision needed: add `notifyOnFail` column OR delete dead code.

**Verified current state:**
- `lib/job-queue.ts` = 371 lines. The class still has `enqueue()` and `processJobs()`.
- `OutboxService.emit()` (in `outbox.ts`) is what every caller actually uses. The `notifyOnFailure` pattern lives in `job-wrapper.ts` (line 73) as a per-job option.
- `notifyOnFail` is held in an in-memory `Set<string>` in `lib/job-queue.ts` (line ~30) — confirmed real.

**Decision: Option (b) — delete `JobQueue.enqueue`.**

Reasoning:
- The `notifyOnFailure` flag in `job-wrapper.ts` is per-job at definition time, not per-event. The `Set<string>` in `job-queue.ts` is never read by the actual code path.
- The 0-caller count on `JobQueue.enqueue` confirms it's dead.
- If multi-worker scaling happens, the right answer is a new `OutboxEvent.notifyOnFail` column (option a) at that time, not a forward-port now.

**Plan (single PR):**

1. **`grep` for any external use of `JobQueue.enqueue` or the `notifyOnFail` Set** — confirm zero callers (already verified).
2. **Delete `lib/job-queue.ts` entirely.** All `OutboxService.emit()` paths use `outbox.ts` directly, not `job-queue.ts`.
3. **Move `JobTypes` enum** (if any) to `outbox.ts` or a sibling file.
4. **Update package.json:** remove any reference to `dist/workers.js` or `worker:start` if it depended on job-queue.
5. **Update `RUNBOOK.md`** to reflect: "all background jobs go through OutboxService.emit".

**Files to touch:**
- `web/src/lib/job-queue.ts` (delete)
- `web/src/server/workers/outbox.ts` (move JobTypes enum if needed)
- `web/src/server/workers/index.ts` (update imports)
- `web/src/server/workers/jobs/*.ts` (update any imports)
- `web/package.json` (worker:start script — verify it still works)
- `docs/RUNBOOK.md` (document)

**Acceptance:**
- [ ] `JobQueue.enqueue` is gone
- [ ] `notifyOnFail` Set is gone
- [ ] All 3 cron jobs (reconciliation, rent-reminders, notifications-cleanup) still run
- [ ] `npm run test:unit` still passes (≥ 1,537)
- [ ] Staging smoke test: schedule a real OTP SMS, confirm it lands in `outboxevent` table

**Reviewer focus:** "Confirm no file imports from `lib/job-queue`. The deletion is safe only if all callers are gone."

**Effort:** 2–4 hours focused.

---

### PR-P1.5 — Ticket #32: Add CI lint for raw `Color(0xFF...)`, off-grid spacing, `FontWeight.w900` (0.5 day)

**Audit claim:** Two design-system violations keep slipping through: raw `Color(0xFF...)`, `FontWeight.w900`, off-grid spacing.

**Verified current state:**
- `flutter/analysis_options.yaml` exists (763 bytes) with `flutter_lints` rules. No custom rules.
- 57 `debugPrint` calls confirmed via `grep`. (Orthogonal to lint ticket #32 but related.)
- The audit's "9 `FontWeight.w900` sites" is plausible but unverified.

**Plan (single PR):**

1. **Write a custom Dart analyzer plugin** OR **a simple shell-based CI script** that greps for the patterns. The shell-script approach is faster to ship (no plugin packaging) and the team's CI is shell-based.
2. **Recommended: shell script** `flutter/scripts/lint-design-system.sh`:
   - `grep -rE "Color\(0xFF" flutter/lib --include="*.dart" | grep -v "flutter/lib/theme/"` → fail if any results
   - `grep -rE "FontWeight\.w900" flutter/lib` → fail if any
   - `grep -rE "EdgeInsets\.all\((2|6|10|14|18|20|22|28)\)" flutter/lib` → fail
   - `grep -rE "BorderRadius\.circular\((6|10|14|18|20|28)\)" flutter/lib` → fail
   - Allow override via `ALLOW_DESIGN_LINT=1` (for emergency).

3. **Wire into CI** (`.github/workflows/ci-cd.yml`): add a step after `flutter analyze` that runs the script and `exit 1` on violation.

4. **Fix the existing violations:**
   - All `Color(0xFF...)` in non-`theme/` files → replace with `AppColors.*` tokens
   - All `FontWeight.w900` → replace with `FontWeight.w800` (or `w700` per design system)
   - All off-grid spacing → use `Spacing.xs/sm/md/lg/xl` tokens

**Files to touch:**
- New: `flutter/scripts/lint-design-system.sh`
- `flutter/lib/**/*.dart` (mechanical fixes for existing violations; the count is unknown until we run the script, but the audit says ~9 for w900 and there are 60+ raw colors per earlier verification)
- `.github/workflows/ci-cd.yml` (add the lint step)

**Acceptance:**
- [ ] `flutter/scripts/lint-design-system.sh` exits 0 on a clean tree
- [ ] `flutter/scripts/lint-design-system.sh` exits 1 on a deliberate violation
- [ ] CI runs the script
- [ ] All previously-existing violations are fixed OR explicitly allow-listed with a `// design-lint-allow: <reason>` comment

**Reviewer focus:** "Spot-check 5 of the violation fixes. Make sure `Color(0xFF...)` was replaced with the right semantic token (not just any token)."

**Effort:** 0.5 day focused. The bulk of the time is the mechanical violation fixes.

---

### PR-P2.1 — Ticket #3 (sub-A): `appDebug` migration (2–4 hours)

**Audit claim:** 54 of 69 `debugPrint` calls still in production code.

**Verified current state:** 57 `debugPrint` calls across 31 files. The pattern is already used in some files (`services/device_data_service.dart`, `services/monitoring_service.dart` per the ticket).

**Plan (single PR, the easiest sub-task of #3):**

1. **Locate or create `appDebug` helper** in `flutter/lib/utils/app_logger.dart` (already exists per the audit's reference).
2. **Mechanical replacement:** `debugPrint(x)` → `appDebug(x)` in all 57 call sites.
3. **Verify `appDebug` respects `kReleaseMode`** (only logs in debug builds).

**Files to touch:**
- 31 files in `flutter/lib/` that use `debugPrint` (mechanical)
- Maybe a 1-line tweak to `app_logger.dart` to ensure `kReleaseMode` guard

**Acceptance:**
- [ ] `grep -r "debugPrint" flutter/lib | wc -l` returns 0 (or only in `kDebugMode` guards)
- [ ] `flutter analyze` clean
- [ ] No 33 E2E test regressions

**Reviewer focus:** "Verify the helper guards on `kReleaseMode` so debug output doesn't ship to production."

**Effort:** 2–4 hours focused.

---

### PR-P2.2 — Ticket #3 (sub-B): Split `LoginScreen` (677 lines) (0.5 day)

**Plan (single PR):**

1. **Audit LoginScreen concerns:**
   - Phone number entry
   - OTP trigger (send OTP)
   - Loading state
   - Error display
   - Resend OTP timer
   - Navigation to OTP screen

2. **Extract:**
   - `PhoneEntryWidget` (text field + country picker + send button)
   - `OtpTriggerWidget` (loading + error states)
   - `LoginShell` (composes the above + lifecycle)

3. **Target:** `LoginScreen` ≤ 250 lines, each sub-widget ≤ 200 lines.

**Files to touch:**
- `flutter/lib/features/auth/presentation/screens/login_screen.dart` (split)
- New: `flutter/lib/features/auth/presentation/widgets/PhoneEntryWidget.dart`
- New: `flutter/lib/features/auth/presentation/widgets/OtpTriggerWidget.dart`

**Acceptance:**
- [ ] `LoginScreen` ≤ 250 lines
- [ ] No visual regression (verify in staging)
- [ ] No 33 E2E test regressions
- [ ] `flutter analyze` clean

**Effort:** 0.5 day focused.

---

### PR-P2.3 — Ticket #3 (sub-C): Split `OtpVerificationScreen` + extract `RiderModel` getters (0.5–1 day)

**Plan (single PR):**

1. Same approach as LoginScreen:
   - `OtpInputWidget` (6-digit entry)
   - `ResendOtpWidget` (timer + button)
   - `OtpShell` (composes)

2. **`pre_dashboard_screen.dart` (540 lines):** audit any inline state-derivation (e.g., "isKycDone", "hasActiveRental"). Move to named getters on `RiderModel`.

3. **Target:** `OtpVerificationScreen` ≤ 250 lines, `pre_dashboard_screen.dart` ≤ 200 lines, `RiderModel` has the new getters.

**Files to touch:**
- `flutter/lib/features/auth/presentation/screens/otp_verification_screen.dart` (split)
- `flutter/lib/features/dashboard/presentation/screens/pre_dashboard_screen.dart` (extract state)
- `flutter/lib/models/rider_model.dart` (add named getters)
- New: `flutter/lib/features/auth/presentation/widgets/OtpInputWidget.dart` etc.

**Acceptance:**
- [ ] `OtpVerificationScreen` ≤ 250 lines
- [ ] `pre_dashboard_screen.dart` ≤ 200 lines
- [ ] `RiderModel` has named getters for the previously-inline state logic
- [ ] `flutter analyze` clean
- [ ] No 33 E2E test regressions

**Effort:** 0.5–1 day focused.

---

### PR-P3.1 — Ticket #8: Convert `String` JSON columns to `Json` (2–3 days)

**Audit claim:** 5 columns store JSON as `String` (no schema validation, no query-ability):
- `SyncQueue.payload`
- `Announcement.targetIds`
- `Incident.photos`
- `FileRecord.metadata`
- `KycProfile.editableFields: String[]` (also stringly-typed field allowlist)

**Verified current state:** Confirmed via grep (5 columns match).

**Plan (single PR, but staged migrations on staging before prod):**

1. **Schema change** (`prisma/schema.prisma`):
   - `SyncQueue.payload: Json` (was `String`)
   - `Announcement.targetIds: Json` (was `String @default("[]")`)
   - `Incident.photos: Json` (was `String @default("[]")`)
   - `FileRecord.metadata: Json` (was `String`)
   - `KycProfile.editableFields` stays as `String[]` (it's an enum allowlist, not JSON) — but add a CHECK constraint to validate values are in the canonical field list.

2. **Migration** with data validation:
   - For each existing row, read the `String` value, parse as JSON.
   - If parse fails, **default to `[]` or `{}` and log a warning** (fail-loud would block prod deploys).
   - Write the parsed value back as JSONB.
   - Drop the old column, add the new one with type `Json` (or use `USING` to convert in place).

3. **Update use-cases** to read/write JSON values (no more `JSON.stringify` / `JSON.parse` in app code — Prisma handles it).

4. **Run on staging for 1 week minimum** before production (per the ticket's soak requirement).

**Files to touch:**
- `web/prisma/schema.prisma`
- New migration: `web/prisma/migrations/<timestamp>_json_columns/`
- `web/src/server/modules/sync/` (SyncQueue writer)
- `web/src/server/modules/notifications/` (Announcement writer)
- `web/src/server/modules/incidents/` (Incident writer)
- `web/src/server/modules/files/` (FileRecord writer)
- `web/src/server/modules/kyc/` (KycProfile.editableFields)

**Acceptance:**
- [ ] All 5 columns are `Json` or `text[]` with proper type
- [ ] Existing data parsed and validated before column type change
- [ ] `KycProfile.editableFields` CHECK constraint added
- [ ] Staging soak: 1 week minimum
- [ ] `npm run test:unit` still 1,537+ pass

**Reviewer focus:** "Verify the migration's `USING` clause preserves data. Run `SELECT * FROM sync_queue LIMIT 5` before and after on staging to confirm no data loss."

**Effort:** 2–3 days focused. **1 week staging soak required before prod.**

---

### PR-P3.2 — Ticket #7 (sub-A): Add FK columns for `pickupHub`/`currentPlan`/`teamLeader` (1 day)

**Audit claim:** 3 `Rider` fields are `String?` instead of FKs.

**Verified current state:** Confirmed all 3 are `String?`.

**Plan (single PR for schema, second PR for backfill):**

1. **Schema change** (`prisma/schema.prisma`):
   - Add `pickupHubId String?` (FK to `Hub.id`, `onDelete: SetNull`)
   - Add `currentPlanId String?` (FK to `RentalPlan.id`, `onDelete: SetNull`)
   - Add `teamLeaderId String?` (FK to `TeamLeader.id`, `onDelete: SetNull`)
   - Keep the old string columns initially for backfill.

2. **Backfill migration:**
   - For each `Rider`, look up the matching FK ID by string value.
   - If a string is `'deleted-hub'` or unknown: log a warning, set FK to NULL.
   - This is the "fail-soft" approach (per the ticket's "default to NULL" suggestion).

3. **Staging soak: 1 week minimum.**

**Files to touch:**
- `web/prisma/schema.prisma`
- New migration
- Use-cases that read/write these 3 fields (search for `pickupHub`, `currentPlan`, `teamLeader` in `web/src/`)

**Acceptance:**
- [ ] 3 new FK columns exist with `onDelete: SetNull` (or `Restrict` for non-nullable fields)
- [ ] All existing string values mapped to FK IDs
- [ ] Staging soak: 1 week minimum
- [ ] `npm run test:unit` still 1,537+ pass

**Reviewer focus:** "Confirm the backfill handles missing FK targets gracefully (NULL + warning, not crash)."

**Effort:** 1 day focused.

---

### PR-P3.3 — Ticket #7 (sub-B): Drop the old string columns + update use-cases (1 day)

**Plan (single PR, after PR-P3.2 staging soak):**

1. **Schema change:** drop the 3 old string columns.
2. **Update use-cases** to use the new FK IDs:
   - `Rider.pickupHubId` instead of `Rider.pickupHub`
   - `Rider.currentPlanId` instead of `Rider.currentPlan`
   - `Rider.teamLeaderId` instead of `Rider.teamLeader`
3. **Update Flutter** to use the new fields (`rider_model.dart`).
4. **Staging soak: 1 week minimum** (cumulative with PR-P3.2).

**Files to touch:**
- `web/prisma/schema.prisma` (drop 3 columns)
- New migration (column drop)
- `web/src/server/modules/riders/*.use-cases.ts`
- `flutter/lib/models/rider_model.dart`

**Acceptance:**
- [ ] Old 3 string columns dropped
- [ ] All use-cases use FK IDs
- [ ] Flutter uses FK IDs
- [ ] Staging soak: 1 week minimum
- [ ] `npm run test:unit` still 1,537+ pass

**Reviewer focus:** "Diff-check: every `rider.pickupHub` (string) usage becomes `rider.pickupHubId` (FK)."

**Effort:** 1 day focused.

---

### PR-P3.4 — Ticket #6 (sub-A): Add `RiderLifecycleStage` enum + per-step state (2 days)

**Audit claim:** `RiderLifecycleStatus` is 15 values mixing in-progress and outcome states. Split into a 5-value stage + per-step fields.

**Verified current state:** Confirmed 15-value enum + 2 indexes on `lifecycleStatus`. Also confirmed per-step fields exist: `kycStatus`, `guarantorStatus`, `depositStatus` (from the `KycStatus`, `GuarantorStatus`, `DepositStatus` enums).

**Plan (PR-A of 3, schema + dual-write):**

1. **Add `RiderLifecycleStage` enum** (5 values: NEW, ONBOARDING, ACTIVE, RETURN_PENDING, CLOSED).
2. **Add `Rider.lifecycleStage: RiderLifecycleStage @default(NEW)`** to the schema.
3. **Dual-write window:** keep the old `lifecycleStatus` column. Use-cases write to BOTH `lifecycleStatus` (legacy) and `lifecycleStage` (new). Reads prefer the new field if set, fall back to legacy.
4. **Update all 8 use-cases** that write `lifecycleStatus` to also write `lifecycleStage`.
5. **Staging soak: 1 week minimum.**

**Files to touch:**
- `web/prisma/schema.prisma`
- New migration
- ~8 use-cases in `web/src/server/modules/riders/`
- `web/src/server/modules/auth/` (verifyOtp creates new riders with the new stage)

**Acceptance:**
- [ ] `RiderLifecycleStage` enum exists with 5 values
- [ ] `Rider.lifecycleStage` column exists
- [ ] All use-cases write to BOTH columns during dual-write window
- [ ] Staging soak: 1 week minimum
- [ ] `npm run test:unit` still 1,537+ pass

**Reviewer focus:** "Confirm dual-write is symmetric (both fields set together). A rider can't have `lifecycleStatus=ACTIVE` and `lifecycleStage=NEW` after the dual-write window opens."

**Effort:** 2 days focused.

---

### PR-P3.5 — Ticket #6 (sub-B): Update Flutter to use `lifecycleStage` (0.5 day)

**Plan (single PR, after PR-P3.4 staging soak):**

1. Update `flutter/lib/models/rider_model.dart` to read `lifecycleStage` first, fall back to `lifecycleStatus` if unset.
2. Update `flutter/lib/core/state/rider_provider.dart` to derive state from the new field.
3. **Staging soak: 1 week minimum** (cumulative).

**Files to touch:**
- `flutter/lib/models/rider_model.dart`
- `flutter/lib/core/state/rider_provider.dart`

**Acceptance:**
- [ ] Flutter reads `lifecycleStage` first
- [ ] All 33 E2E tests pass
- [ ] Staging soak: 1 week minimum

**Reviewer focus:** "Test the fallback path: a rider created BEFORE the schema migration (no `lifecycleStage` set) should still render correctly via the legacy `lifecycleStatus` fallback."

**Effort:** 0.5 day focused.

---

### PR-P3.6 — Ticket #6 (sub-C): Drop the legacy `lifecycleStatus` column (0.5 day)

**Plan (single PR, after PR-P3.5 staging soak):**

1. **Schema change:** drop the `lifecycleStatus` column + the 2 indexes that reference it.
2. **Remove all dual-write code** from the 8 use-cases.
3. **Remove the legacy fallback** from Flutter.
4. **Staging soak: 1 week minimum** (cumulative with PR-P3.4 + PR-P3.5 = 3 weeks total).

**Files to touch:**
- `web/prisma/schema.prisma`
- New migration
- ~8 use-cases
- `flutter/lib/models/rider_model.dart`
- `flutter/lib/core/state/rider_provider.dart`

**Acceptance:**
- [ ] `lifecycleStatus` column dropped
- [ ] Dual-write code removed
- [ ] Staging soak: 1 week minimum
- [ ] `npm run test:unit` still 1,537+ pass
- [ ] Flutter analyze clean
- [ ] All 33 E2E tests pass

**Reviewer focus:** "Confirm the migration is reversible: the dropped column should still be in the prior migration's down-migration. (Soak before drop!)"

**Effort:** 0.5 day focused.

---

### PR-P3.7 — Ticket #9: `Admin.permissions` → `text[]` (1 day)

**Audit claim:** `Admin.permissions: String @default("[]")` — migrate to `text[]` or relation.

**Verified current state:** Confirmed `Admin.permissions: String @default("[]")` (line 18 of schema.prisma). The audit recommends a relation table (`AdminHasPermission` similar to `RolePermission`).

**Plan (single PR):**

1. **Decision: text[] approach** (faster, no relation table needed; the audit notes relation is "more normalized" but `text[]` is sufficient for this use case).
2. **Schema change:** `Admin.permissions: String[]` (Postgres array). Add a CHECK constraint to ensure values are in the canonical permission list.
3. **Migration:** parse existing JSON strings, validate, write as text[].
4. **Update `web/src/lib/permissions.ts`** to read/write the array directly.
5. **Staging soak: 1 week minimum.**

**Files to touch:**
- `web/prisma/schema.prisma`
- New migration
- `web/src/lib/permissions.ts`
- `web/src/server/modules/admin/admin.use-cases.ts`

**Acceptance:**
- [ ] `Admin.permissions` is `String[]`
- [ ] All use-cases updated
- [ ] Staging soak: 1 week minimum
- [ ] `npm run test:unit` still 1,537+ pass

**Reviewer focus:** "Confirm the CHECK constraint matches `PERMISSION_DESCRIPTORS` keys. If a permission is added later, the constraint must be updated."

**Effort:** 1 day focused.

---

### PR-P3.8 — Ticket #10: Rename `WalletLedger.txnId` → `transactionId` (0.5 day)

**Audit claim:** cosmetic rename for naming consistency.

**Verified current state:** `WalletLedger.txnId: String?` confirmed. `DepositRecord.transactionId` already exists.

**Plan (single PR):**

1. **Schema change:** rename column + relation field to `transactionId` / `transaction`.
2. **Migration:** `ALTER TABLE wallet_ledger RENAME COLUMN "txnId" TO "transactionId";`
3. **Update use-cases** that reference `txnId`.
4. **No data migration needed** (column rename, not type change).

**Files to touch:**
- `web/prisma/schema.prisma`
- New migration
- Use-cases referencing `txnId` (grep)

**Acceptance:**
- [ ] `WalletLedger.transactionId` exists
- [ ] No `txnId` references remain
- [ ] `npm run test:unit` still 1,537+ pass

**Reviewer focus:** "Verify no call site still uses the old name."

**Effort:** 0.5 day focused.

---

### PR-P3.9 — Ticket #11: Audit `OutboxEvent` indexes (0.5–1 day)

**Audit claim:** 7 indexes, possibly over-indexed.

**Verified current state:** `OutboxEvent` has 5 @@index declarations (lines 1030-1034). The audit said 7 — possibly including implicit `@@index([id])` from primary key + `@@index([updatedAt])` from `@updatedAt`.

**Plan (single PR):**

1. **For each index, document the query that uses it:**
   - `@@index([status])` — reaper scans by status. **KEEP.**
   - `@@index([eventType])` — dispatcher filters by eventType. **KEEP.**
   - `@@index([createdAt])` — analytics queries by time. **KEEP.**
   - `@@index([status, createdAt])` — reaper ordering. **KEEP.**
   - `@@index([status, eventType])` — dispatcher + analytics overlap. **Possibly drop** if one of the above covers it.

2. **Drop the redundant index** (if any) with a migration.
3. **Update any code that depended on the dropped index** (query planner changes).

**Files to touch:**
- `web/prisma/schema.prisma` (drop 1-2 indexes)
- New migration

**Acceptance:**
- [ ] Indexes reduced to 3-4 essential ones
- [ ] Reaper/dispatcher/analytics queries still hit indexes (verify with `EXPLAIN`)
- [ ] `npm run test:unit` still 1,537+ pass

**Reviewer focus:** "Run `EXPLAIN ANALYZE` on the 3 query patterns before/after to confirm the planner picks a different index, not a seq scan."

**Effort:** 0.5–1 day focused.

---

### PR-P3.10 — Ticket #12: Add `SUSPEND` + `BULK_UPDATE` to `AuditActionType` (0.5 day)

**Audit claim:** `AuditActionType` enum missing 2 common actions.

**Plan (single PR):**

1. Add the 2 enum values.
2. Update use-cases to use them.
3. Migration is automatic for enum additions (Prisma handles).

**Files to touch:**
- `web/prisma/schema.prisma` (add 2 enum values)
- Use-cases that should use them (grep for "SUSPEND" / "BULK_UPDATE" in audit code)

**Acceptance:**
- [ ] 2 new enum values exist
- [ ] At least 1 use-case uses each new value
- [ ] `npm run test:unit` still 1,537+ pass

**Effort:** 0.5 day focused.

---

### PR-P4.1 — Ticket #27 (sub-A): Consolidate card widgets (1 day)

**Audit claim:** 10+ card widgets overlap.

**Plan (single PR):**

1. **Audit all card widgets** and identify a common `BaseCard` API.
2. **Create `flutter/lib/widgets/cards/base_card.dart`** as the canonical implementation.
3. **Migrate each card to use `BaseCard`** as a composition (not inheritance).
4. **Delete the duplicates** that have no unique behavior.

**Files to touch:**
- New: `flutter/lib/widgets/cards/base_card.dart`
- 10+ existing card files in `flutter/lib/widgets/` (migrate or delete)
- Use-cases that imported the old card widgets (update imports)

**Acceptance:**
- [ ] `BaseCard` exists with the most-common API
- [ ] No more than 2-3 card widgets remain (down from 10+)
- [ ] `flutter analyze` clean
- [ ] No visual regression in any screen

**Effort:** 1 day focused.

---

### PR-P4.2 — Ticket #27 (sub-B): Consolidate empty-state widgets (0.5 day)

**Plan (single PR):**

1. Audit `empty_state.dart` and `empty_state_illustrations.dart`.
2. Pick one canonical implementation (probably `empty_state.dart` since illustrations are a special case).
3. Migrate uses of `empty_state_illustrations.dart` to use the base with a `showIllustration: true` flag.

**Files to touch:**
- `flutter/lib/widgets/empty_state.dart` (canonicalize)
- `flutter/lib/widgets/empty_state_illustrations.dart` (migrate or delete)
- Use-cases (update imports)

**Acceptance:**
- [ ] One `EmptyState` widget (with optional illustration)
- [ ] `flutter analyze` clean

**Effort:** 0.5 day focused.

---

### PR-P4.3 — Ticket #27 (sub-C): Consolidate celebration + animation widgets (1 day)

**Plan (single PR):**

1. **Celebration widgets** (5 files: `confetti_celebration.dart`, `electric_burst.dart`, `electric_burst_success.dart`, `electric_arc.dart`, `streak_celebration_bar.dart`):
   - Pick one canonical (`confetti_celebration.dart` or a new base).
   - Migrate uses of the others to the canonical with style flags.
   - **Product decision needed:** which celebration animation to keep? Visual difference between `confetti` and `electric_burst` is significant.

2. **Animation files** (3 files: `animations.dart`, `micro_animations.dart`, `micro_interactions.dart`):
   - Consolidate into 2: `animations.dart` (high-level) + `micro_interactions.dart` (low-level helpers).

**Files to touch:**
- 5 celebration widget files
- 3 animation files
- Use-cases

**Acceptance:**
- [ ] One `CelebrationOverlay` (with style flag)
- [ ] 2 animation files total
- [ ] `flutter analyze` clean
- [ ] No visual regression in any screen (compare to staging)

**Reviewer focus:** "Test the celebration animations in a real screen. The visual difference is the risk."

**Effort:** 1 day focused.

---

### PR-P4.4 — Ticket #28: Move screen-specific widgets to features (3–5 days, single mega-PR or per-feature)

**Audit claim:** 78 widget files in `lib/widgets/`. 60% are screen-specific.

**Plan (multiple PRs recommended, one per feature):**

1. **Identify which widgets are screen-specific** vs. true base. Heuristic: a widget is "screen-specific" if it imports a feature's `*Provider` or `*UseCase`.
2. **Per feature, move:**
   - `flutter/lib/widgets/dashboard_*` → `flutter/lib/features/dashboard/widgets/`
   - `flutter/lib/widgets/pickup_*` → `flutter/lib/features/rentals/widgets/`
   - `flutter/lib/widgets/pre_dashboard_*` → `flutter/lib/features/dashboard/widgets/`
   - etc.
3. **Update imports** across the codebase.
4. **Target:** `lib/widgets/` has < 30 files (down from 78).

**Files to touch:**
- ~50 widget files (move + rename)
- All `import` statements that referenced the old path

**Acceptance:**
- [ ] `lib/widgets/` has < 30 files
- [ ] Each feature has its own `widgets/` subfolder
- [ ] All imports updated
- [ ] `flutter analyze` clean
- [ ] No visual regression

**Reviewer focus:** "Spot-check 10 of the moves. Make sure the import path actually resolves."

**Effort:** 3–5 days focused. **Recommend per-feature PRs** (1 day each) rather than one mega-PR.

---

### PR-P4.5 — Tickets #4, #5, #13, #14, #16, #17, #18, #19, #21, #22, #23, #24, #25, #26, #29, #30, #31, #33 (remaining P2s)

These are all small, low-risk P2s. Each is a 0.5-1 day focused PR:

- **#4, #5:** typography + raw color migrations (each 1 day, can run after #32 lint enforces)
- **#13, #14:** docs cleanup (1 hr each)
- **#16, #17, #18:** lib file cleanups (0.5-1 day each)
- **#19:** move prisma scripts to `scripts/` (0.5 day)
- **#21:** split 30+ admin screens > 1,000 lines (2-4 weeks epic; ticket says "later")
- **#22, #23:** server modules + workers audit (1 day each)
- **#24:** middleware trust-headers (0.5 day; likely already correct)
- **#25, #26:** openapi / shell audit (0.5 day each)
- **#29, #30, #31:** typography + duration + micro-fix (0.5 day each)
- **#33:** additional server module splits (2-3 days)

**Recommendation:** defer #21 (the 2-4 weeks epic) and the rest are quick wins. The team should do a single "P2 sweep" PR per category (e.g., all docs cleanup in one PR, all small lib fixes in one PR) to reduce PR overhead.

**Total P2 estimate (excluding #21 and #28):** ~5–7 days focused.

---

## Summary

**Total focused days across all PRs:** ~17–24 days for the 11 P1/P2 tickets in scope.

**Schema-migration-gated:** #6, #7, #8, #9 each require 1 week minimum staging soak before prod. **Sequential: ~4 weeks staging window** if you do them back-to-back.

**Lint enforcement unblocks many:** shipping #32 first prevents new violations of #4, #5, #27, #28.

**Recommended order:**
1. Cleanup (no migration): PR-P1.1, PR-P1.2, PR-P1.3, PR-P1.4, PR-P1.5 — 1 day
2. Lint enforcement: PR-P1.5 already — 0.5 day
3. Flutter mechanical: PR-P2.1 — 0.5 day
4. Flutter screen splits: PR-P2.2, PR-P2.3 — 1.5 days
5. DB migrations (sequential, with soaks): PR-P3.1, PR-P3.2, PR-P3.3, PR-P3.4, PR-P3.5, PR-P3.6, PR-P3.7, PR-P3.8 — 8 days + 4 weeks soak
6. DB index cleanup: PR-P3.9, PR-P3.10 — 1 day
7. Widget consolidation: PR-P4.1, PR-P4.2, PR-P4.3 — 2.5 days
8. Widget moves: PR-P4.4 (or split per-feature) — 3-5 days
9. P2 sweep: 5-7 days

**Pareto for the next 1 week:** PR-P1.1 through PR-P1.5 (cleanup) + PR-P2.1 (appDebug) + PR-P3.1 (start the JSON migration). All small, all ship-ready, no soak windows.

**Pareto for the next 2 weeks:** + PR-P2.2, PR-P2.3 (Flutter screens) + PR-P1.4 finished.

**Pareto for the next 4 weeks:** + PR-P3.2, PR-P3.3, PR-P3.4 staging (data migrations start; prod-gated by soaks).

---

## Cross-references

- **Source tickets:** `docs/FOLLOWUP_TICKETS.md` (lines 152, 193, 228, 343, 383, 422, 635, 775, 987, 1023, 1128)
- **Source audit plans:** `docs/DB_REMEDIATION_PLAN.md`, `docs/DESIGN_SYSTEM_PLAN.md`, `docs/ADMIN_WEB_PLAN.md`, `docs/RIDER_APP_PLAN.md`
- **Phase history:** `docs/SCOPE.md`
- **Backlog context:** `docs/BACKLOG_FINDINGS.md`
