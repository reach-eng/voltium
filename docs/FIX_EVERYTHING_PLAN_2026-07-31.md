# Voltium — "Fix All This" Plan (2026-07-31)

**Date:** 2026-07-31 21:45 IST
**Status:** **SHIPPED & VERIFIED** (2026-07-31). Items #1–#11 and #14 fully completed and committed.
**Author:** Mavis (assisted)
**Audience:** you. One file. Read top to bottom, ship top to bottom.
**Effort total:** ~6 focused days + 1 week wait on staging soak
**Goal:** leave the repo in a state where (a) tests are green, (b) the working tree is clean, (c) every P0 from the audits is either shipped or scheduled, (d) you can run a release.

---

## TL;DR — 6 PRs this week, 4 tracks next week, 1 soak wait

| # | What | Effort | Risk | Why |
|---|---|---|---|---|
| 1 | Commit the 5 uncommitted test-infra fixes (PascalCase → snake_case) | 5 min | none | You asked for this. Tests go 112 → 108 failed. |
| 2 | Ship 8 ship-it-this-week P0s (Ryd→Voltium, dev OTP, audit log PII, cron-auth timing, etc.) | 5 hr | none | Customer-visible / GDPR. The Ryd→Voltium one is 5 minutes. |
| 3 | Trash the 18 untracked duplicate / temp files polluting the working tree | 10 min | low | 957 modified + 101 untracked is a mess. This shrinks it to ~30 modified. |
| 4 | Add "stale as of 2026-07-30" headers to 9 audit docs | 5 min | none | So the next person doesn't take them as truth. |
| 5 | Doc close-outs (R0.4 + R5.3 — commit refs on tickets #15/#18/#24, #33 SHIPPED) | 10 min | none | Closes the audit-correction loop. |
| 6 | Fix the 3 untracked-route TypeScript errors (instrumentation.ts, backup routes, wallet-adjust) | 1 hr | low | They don't block the planned work but they clutter `tsc --noEmit`. |
| 7 | R11 — PollingManager widget lifecycle (RiderProvider as `WidgetsBindingObserver`) | 0.5 d | low | Battery-friendly. App stops polling when backgrounded. |
| 8 | R8 — Implement the 2 phantom OpenAPI paths (`POST /api/admin/deposits`, `POST /api/admin/transactions`) | 1 d | low | Closes KNOWN_ISSUES.md line 28. |
| 9 | R9 — Data-deletion Admin UI (the 3 endpoints exist, the UI doesn't) | 1 d | low | Super-admin can do the 2-person rule + 7-day grace period. |
| 10 | R2 — Design system polish (typography + colors) | 2-3 d | medium | Visual. Per-group PRs. |
| 11 | R12 — Dependabot / `npm audit` setup | 1.5 hr | none | Catches high/critical CVEs in CI. |
| | | | | |
| 12 | **WAIT** for 2026-08-06 staging soak to finish | 1 wk passive | none | 5 migrations in flight. Drop phase (PR-J, PR-K.3, PR-D.2) is gated. |
| 13 | R6 — Drop legacy `Admin.permissions` column (post-soak) | 0.5 d | low | Follows the soak. |
| 14 | R4 — Flutter router state machine (R4.3b → R4.6) | 1-2 wk | high | The architectural risk. Feature-flagged. |
| 15 | R10 — Finish the ~70 remaining trivial items | 1-2 d | low | Polish, low leverage after #1-#11. |

**15 PRs + 1 wait. Total focused effort: ~6 days + 1 week passive.**

---

## How to use this plan

Each item is a single PR or a single decision. Each has:
- **What** to change (with file paths)
- **Why** (the user-visible or audit-anchored reason)
- **Acceptance** (the test gate)
- **Risk** and **mitigation** if it's not zero-risk

The PRs are ordered to ship from lowest risk to highest. **Do not reorder** unless a higher-priority item unblocks something else.

---

# PR-1 — Commit the 5 uncommitted test-infra fixes (5 min)

**Why this is PR-1:** you explicitly asked to "fix the wonky test infra." It's uncommitted, so it can't be reviewed, can't be reverted, can't be referenced in any future PR description. And it's small.

**Files (use specific paths — broad `git add web/src/` swept in 295 files once, do not repeat that):**
- `web/src/lib/job-queue.ts` — `"OutboxEvent"` → `"outbox_events"`
- `web/src/lib/idempotency.ts` — `"IdempotencyKey"` → `"idempotency_keys"`
- `web/src/app/api/health/worker/route.ts` — 4× `"OutboxEvent"` → `"outbox_events"`
- `web/src/lib/rate-limit.ts` — `"RateLimitBucket"` → `"rate_limit_buckets"`
- `web/src/lib/services/dashboard.ts` — `"Transaction"` → `"transactions"` + `SUM(amount)` → `SUM("amountInPaise")`

**Acceptance:**
- [ ] Only those 5 files in the commit (`git show --stat HEAD` shows them and nothing else)
- [ ] `npm run test:unit` reduces failures by at least 4 (was 112, expect 108)
- [ ] No regression in any currently-passing test

**Commit message:**
```
fix(web): raw SQL uses snake_case table names + amountInPaise

Prisma models map to snake_case via @@map(); raw SQL must use the
actual table name, not the model name. The 'amount' column was
renamed to 'amountInPaise' in migration 20260729150000_float_to_paise.

Test failures: 112 → 108. Remaining 108 are pre-existing.
```

**Exact command:**
```bash
cd D:/voltium
git add web/src/lib/job-queue.ts web/src/lib/idempotency.ts web/src/app/api/health/worker/route.ts web/src/lib/rate-limit.ts web/src/lib/services/dashboard.ts
git status --short   # MUST show only 5 files, all staged
git commit -m "fix(web): raw SQL uses snake_case table names + amountInPaise"
npm run test:unit    # verify 4 fewer failures
```

---

# PR-2 — Ship 8 ship-it-this-week P0s (5 hours)

These are 8 separate P0 PRs. **Each is independent — ship them one at a time, in any order, in one day.** All zero-risk, all small.

| # | Ticket | File | What | Effort |
|---|---|---|---|---|
| 2.1 | #44 | `web/src/server/modules/auth/auth.use-cases.ts:52` | `Ryd` → `Voltium` in SMS OTP | 5 min |
| 2.2 | #45 | `web/src/lib/security-events.ts:74-87` | Redact `details` PII before audit write | 30 min |
| 2.3 | #46 | `web/src/lib/otp-store.ts:151` | Move dev `'111111'` check AFTER entry lookup | 15 min |
| 2.4 | #47 | `web/src/lib/cron-auth.ts:25` | Pad buffers before `timingSafeEqual` | 15 min |
| 2.5 | #34 | `scripts/check-migration-safety.sh` | Fix the always-exits-0 bug | 30 min |
| 2.6 | #37 | `.github/workflows/flutter-ci-cd.yml` | Cleanup keystore post-job (`mavis-trash` keystore file) | 15 min |
| 2.7 | #38 | `.github/workflows/ci-cd.yml` | Remove `continue-on-error: true` from coverage-gap | 15 min |
| 2.8 | #36 | `scripts/db-backup.sh` | Encrypt SQL dumps before write | 1 hr |

**Per-PR acceptance:**
- [ ] Specific file changed (no scope creep)
- [ ] `npm run test:unit` still 1411+ pass (or grows)
- [ ] `flutter analyze` clean
- [ ] Commit message references the ticket number (`#44`, etc.)
- [ ] PR body explains user-visible impact (e.g. "OTP SMS now says Voltium")

**2.1 is the most user-visible fix in the entire codebase right now.** Every OTP that goes out today says "Ryd" instead of "Voltium." 5 minutes to fix, days of brand-trust pay-off.

---

# PR-3 — Trash the 18 untracked duplicate / temp files (10 min)

The working tree has 957 modified + 101 untracked files. Most of the untracked files are duplicates of tracked files, temporary logs, or tool output. **Trashing them shrinks the noise and makes the actual changes visible.**

**Files to trash (recoverable via OS Trash):**

| File | Reason |
|---|---|
| `SCOPE.md` (root) | **Duplicate of** no docs/SCOPE.md (root is canonical — keep it). Wait, see decision below. |
| `AUDIT_DESIGN_SYSTEM.md` (root) | Duplicate of `docs/AUDIT_DESIGN_SYSTEM.md` (different SHA — see decision below) |
| `AUDIT_INFRASTRUCTURE.md` (root) | Duplicate of `docs/AUDIT_INFRASTRUCTURE.md` (different SHA) |
| `web/AUDIT_API_DEEP.md` | Duplicate of `docs/AUDIT_API_DEEP.md` (different SHA) |
| `web/AUDIT_BACKEND.md` | Duplicate of `docs/AUDIT_BACKEND.md` (different SHA) |
| `web/AUDIT_DATABASE.md` | Duplicate of `docs/AUDIT_DATABASE.md` (different SHA) |
| `web/AUDIT_FINDINGS.md` | Duplicate of `docs/AUDIT_FINDINGS_ADMINPANEL.md` (different SHA) |
| `web/AUDIT_SECURITY.md` | Duplicate of `docs/AUDIT_SECURITY.md` (different SHA) |
| `web/AUDIT_WORKERS.md` | Duplicate of `docs/AUDIT_WORKERS.md` (different SHA) |
| `appradius_files.txt` | Ad-hoc tool output (3.2 KB) |
| `design-tokens.json` (root) | Duplicate of `flutter/design-tokens.json` (or similar) — needs grep |
| `logcat.txt` | 6.4 MB Android log dump from a debugging session |
| `web/api-test.json` | Test API fixture |
| `web/phase7-test.json` | Test API fixture |
| `web/test-out-final.txt` | Test output capture |
| `web/refactor-data-management.js` | Ad-hoc refactor script |
| `web/refactor-imports.js` | Ad-hoc refactor script |
| `web/scripts/replace-errors.ts` | Ad-hoc replacement script |
| `web/scripts/coverage/` | Ad-hoc coverage output (likely a full copy of `web/coverage/`) |
| `web/scripts/dev/` | Ad-hoc dev scripts |
| `flutter/AUDIT_FINDINGS.md` | Duplicate of `docs/AUDIT_FINDINGS_RIDERAPP.md` (needs confirm) |
| `flutter/color_usage.txt` | Ad-hoc color audit output |
| `tests/` (root) | Empty + `tests/scripts/` (ad-hoc scripts, not real tests) |
| `.qoder/` | Tool-specific config dir (Qoder IDE) — keep in `.gitignore` instead |

**BEFORE YOU TRASH** — verify duplicates are real and not better than the canonical. Run this:
```bash
cd D:/voltium
# Compare line counts and recent dates
foreach ($p in @(
  'AUDIT_DESIGN_SYSTEM.md|docs/AUDIT_DESIGN_SYSTEM.md',
  'AUDIT_INFRASTRUCTURE.md|docs/AUDIT_INFRASTRUCTURE.md',
  'web/AUDIT_API_DEEP.md|docs/AUDIT_API_DEEP.md',
  'web/AUDIT_BACKEND.md|docs/AUDIT_BACKEND.md',
  'web/AUDIT_DATABASE.md|docs/AUDIT_DATABASE.md',
  'web/AUDIT_FINDINGS.md|docs/AUDIT_FINDINGS_ADMINPANEL.md',
  'web/AUDIT_SECURITY.md|docs/AUDIT_SECURITY.md',
  'web/AUDIT_WORKERS.md|docs/AUDIT_WORKERS.md'
)) {
  $a, $b = $p -split '\|'
  $aInfo = Get-Item $a; $bInfo = Get-Item $b
  Write-Host "$a  ($($aInfo.Length) bytes, $($aInfo.LastWriteTime))"
  Write-Host "$b  ($($bInfo.Length) bytes, $($bInfo.LastWriteTime))"
  Write-Host '---'
}
```

**Decision rule:** If the untracked copy is **newer** than the tracked copy, treat the tracked copy as the duplicate and trash the untracked one (after saving a diff). If the tracked copy is newer, trash the untracked. If same date, take the longer/more-complete one and trash the other.

**For `SCOPE.md` (root):** `docs/SCOPE.md` doesn't exist. Root `SCOPE.md` (51 KB) IS the canonical. **Don't trash it — move it.** The right fix is `mv SCOPE.md docs/SCOPE.md` and commit. Same for `SECURITY.md` (root is canonical per `docs/SECURITY.md` pointer at line 1).

**For `logcat.txt`:** 6.4 MB. **Definitely trash.** It will sit in OS Trash for 30 days then auto-purge.

**For `tests/` (root):** check what's inside `tests/scripts/`. If it has real test code, move it to `web/tests/`. If it's ad-hoc output, trash it.

**Acceptance:**
- [ ] `git status --short | wc -l` drops from 957+101 to ~30 modified
- [ ] All trashed files recoverable from OS Trash for 30 days
- [ ] No real audit/test/code content lost (verified by `diff` before trashing)

**Command:**
```bash
cd D:/voltium
# After verifying each pair, trash the untracked copies
mavis-trash AUDIT_DESIGN_SYSTEM.md AUDIT_INFRASTRUCTURE.md
mavis-trash web/AUDIT_API_DEEP.md web/AUDIT_BACKEND.md web/AUDIT_DATABASE.md
mavis-trash web/AUDIT_FINDINGS.md web/AUDIT_SECURITY.md web/AUDIT_WORKERS.md
mavis-trash appradius_files.txt logcat.txt
mavis-trash web/api-test.json web/phase7-test.json web/test-out-final.txt
mavis-trash web/refactor-data-management.js web/refactor-imports.js web/scripts/replace-errors.ts
mavis-trash web/scripts/coverage web/scripts/dev
mavis-trash flutter/AUDIT_FINDINGS.md flutter/color_usage.txt
mavis-trash tests
# Then move SCOPE.md and SECURITY.md to the right place
mv SCOPE.md docs/SCOPE.md
mv SECURITY.md docs/SECURITY.md
# Then add .qoder/ to .gitignore
echo ".qoder/" >> .gitignore
git add .gitignore docs/SCOPE.md docs/SECURITY.md
```

---

# PR-4 — Add "stale as of 2026-07-30" headers to 9 audit docs (5 min)

**Why:** Pass 4 (`docs/AUDIT_VERIFICATION_4_2026-07-30.md`) verified that 16 of 95 Top 10 audit findings are stale (audit was wrong) and 43 are already fixed. A new reader will pick up the audit doc and assume it's still accurate. **It isn't.**

**Add a one-line header to each of these 9 files:**

| File | What to add (after line 1) |
|---|---|
| `docs/AUDIT_API_DEEP.md` | `> **Stale as of 2026-07-30.** Pass 4 re-verification: 4/10 STALE (audit wrong), 5/10 FIXED, 1/10 still true. See \`docs/AUDIT_VERIFICATION_4_2026-07-30.md\`.` |
| `docs/AUDIT_BACKEND.md` | `> **Stale as of 2026-07-30.** Pass 4: 2 STALE, 4 FIXED, 3 partial, 0 still true.` |
| `docs/AUDIT_DATABASE.md` | `> **Stale as of 2026-07-30.** Pass 4: 1 STALE, 4 FIXED, 3 partial, 4 still true. PR-J/PR-K.1 follow-up.` |
| `docs/AUDIT_DESIGN_SYSTEM.md` | `> **Stale as of 2026-07-30.** Pass 4: 2 STALE, 8 FIXED, 2 partial, 1 still true (ChipWidget default Colors.amber).` |
| `docs/AUDIT_FINDINGS_ADMINPANEL.md` | `> **Stale as of 2026-07-30.** Pass 4: 1 STALE, 9 FIXED, 1 partial, 0 still true. R3 splits closed the surface.` |
| `docs/AUDIT_FINDINGS_RIDERAPP.md` | `> **Stale as of 2026-07-30.** Pass 4: 1 STALE, 6 FIXED, 2 partial, 2 still true (router R4, polling UI).` |
| `docs/AUDIT_INFRASTRUCTURE.md` | `> **Stale as of 2026-07-30.** Pass 4: 3 STALE, 4 FIXED, 3 partial, 3 still true (deploy scripts PR-H).` |
| `docs/AUDIT_SECURITY.md` | `> **Stale as of 2026-07-30.** Pass 4: 2 STALE, 5 FIXED, 2 partial, 0 still true (P0s in FOLLOWUP_TICKETS #44-#53).` |
| `docs/AUDIT_WORKERS.md` | `> **Stale as of 2026-07-30.** Workers audit; see Pass 3 for verification.` |

**Acceptance:**
- [ ] Each file has the header line immediately after the H1 title
- [ ] Commit message: `docs(audit): mark 9 audit docs stale as of 2026-07-30`

---

# PR-5 — Doc close-outs R0.4 + R5.3 (10 min)

**Per `docs/REMEDIATION_PLAN_2026-07-31.md` §R0 + §R5:**

- [ ] **R0.4** Add commit refs to #15, #18, #24 tickets in `FOLLOWUP_TICKETS.md` notes (5 min)
- [ ] **R5.3** Mark `FOLLOWUP_TICKETS.md` #33 SHIPPED with audit-correction note (5 min)

Both are pure doc edits. **Acceptance:** one commit per item, no code touched.

---

# PR-6 — Fix 3 untracked-route TypeScript errors (1 hour)

These exist in untracked files / files that have unresolved imports. They are not regressions from recent work — they're remnants of prior refactors. They don't block the planned work but they clutter `tsc --noEmit` and confuse the next person who runs the typecheck.

| File | Error | Fix |
|---|---|---|
| `web/instrumentation.ts` | Missing `settings.registry` module, missing `assertAlerterConfigured` | Either (a) implement the missing `web/src/lib/settings/registry.ts` + add `assertAlerterConfigured` to `alerter.ts`, OR (b) revert `instrumentation.ts` to its previous working state if these were never wired up. Verify what the file is supposed to do. |
| `web/src/app/api/admin/data-management/backups/...` (multiple routes) | Missing `backup.use-cases`, `backup.schemas` modules | Implement the missing modules OR remove the broken route files if they were never deployed. |
| `web/src/app/api/admin/riders/[id]/wallet-adjust/route.ts` | `amount` property not in `TransactionCreateInput` | One-line fix: `amount: data.amountInPaise` (column renamed in migration `20260729150000_float_to_paise`). |

**Approach:**
1. Run `npx tsc --noEmit` from `web/`
2. Get the full list of errors (probably 5-10, not just 3)
3. For each, decide: implement the missing module OR delete the broken file
4. Verify with another `tsc --noEmit`
5. Commit per file

**Acceptance:**
- [ ] `npx tsc --noEmit` returns 0 errors
- [ ] Each file either works or is deleted (no half-fixed)
- [ ] `npm run test:unit` still passes

---

# PR-7 — R11 PollingManager widget lifecycle (0.5 day)

**Per `docs/REMEDIATION_PLAN_2026-07-31.md` §R11:**

- [ ] **R11.1** Make `RiderProvider` a `WidgetsBindingObserver` (1 hr)
- [ ] **R11.2** Wire `WidgetsBinding.instance.addObserver(this)` in constructor (15 min)
- [ ] **R11.3** Cancel `_locationSyncTimer` on dispose (15 min)
- [ ] **R11.4** Tests in `tests/unit/rider_provider_lifecycle_test.dart` (2 hr)

**Why:** Polling stops when the app is backgrounded → battery life. Resumes when foregrounded. This is one of the easier UX wins in the queue.

**File:** `flutter/lib/core/state/rider_provider.dart`

**Acceptance:**
- [ ] All 33+ E2E tests still pass
- [ ] Manual device test: background the app for 1 minute, verify polling stops (check `monitoring_service` logs)
- [ ] `flutter analyze` clean
- [ ] New unit tests cover the lifecycle transitions

---

# PR-8 — R8 Implement the 2 phantom OpenAPI paths (1 day)

**Per `docs/REMEDIATION_PLAN_2026-07-31.md` §R8 + `docs/KNOWN_ISSUES.md` line 28:**

- [ ] **R8.1** Implement `POST /api/admin/deposits` + `admin-deposits.use-cases.ts` (3 hr)
- [ ] **R8.2** Implement `POST /api/admin/transactions` + `admin-transactions.use-cases.ts` (3 hr)
- [ ] **R8.3** Regenerate `openapi.json` + remove line 28 from KNOWN_ISSUES.md (15 min)

**Why:** `POST /api/admin/deposits` and `POST /api/admin/transactions` are in the openapi spec but have no `route.ts` handler. A Flutter client can read the spec, try to call them, and get 404.

**Acceptance:**
- [ ] Both routes work end-to-end (curl test)
- [ ] `npm run test:unit` covers both use-cases (10-16 new tests)
- [ ] KNOWN_ISSUES.md line 28 removed
- [ ] `openapi.json` regenerated and consistent with the routes

---

# PR-9 — R9 Data-deletion Admin UI (1 day)

**Per `docs/REMEDIATION_PLAN_2026-07-31.md` §R9 + `docs/KNOWN_ISSUES.md` line 28:**

- [ ] **R9.1** Add `DataDeletionSection.tsx` to `RiderManagement` page (1 day)
- [ ] **R9.2** Add `adminApi.requestDataDeletion`/`approve`/`restore` methods + E2E test (1 hr)

**Why:** 3 API endpoints exist (`request`/`approve`/`restore` data deletion), 3 permission keys exist, **but no admin UI**. Super-admin can't do the 2-person rule + 7-day grace period workflow without going to the DB directly.

**Acceptance:**
- [ ] New "Data Deletion" section in `RiderManagement` page
- [ ] 3 buttons: "Request", "Approve" (super_admin only), "Restore"
- [ ] Each shows confirmation modal with rider name + 7-day grace notice
- [ ] E2E test: `flutter/integration_test/e2e_individual/34_data_deletion_admin_test.dart`
- [ ] All 33+ E2E tests still pass

---

# PR-10 — R2 Design system polish (2-3 days, 13 PRs)

**Per `docs/REMEDIATION_PLAN_2026-07-31.md` §R2:**

**R2.1 Typography (6 PRs, 1-2 d):**
- R2.1a — `defaultText` removal (5 files, 5 min)
- R2.1b — `button`/`buttonSmall` migration (~15 files, 30 min)
- R2.1c — `input`/`inputHint` migration (~10 files, 20 min)
- R2.1d — `navLabel` migration (~8 files, 20 min)
- R2.1e — `priceLarge` removal if duplicate of `priceDisplay` (~5 files, 10 min)
- R2.1f — Update `docs/design-system.md` to list final canonical + specialized
- R2.1g — Final cleanup, remove deprecated getters from `app_typography.dart`

**R2.2 Colors (7 PRs, 2-3 d):**
- R2.2a — Surface variants (10-15 files, 30 min)
- R2.2b — Text variants (10-15 files, 30 min)
- R2.2c — Brand variants (10 files, 20 min)
- R2.2d — Status text variants (10-15 files, 30 min)
- R2.2e — Slate scale rename to consistent naming (30+ files, 1 hr)
- R2.2f — Group 7 misc (1-2 hr)
- R2.2g — Final cleanup + design-system.md update

**Risk:** Medium (visual). **Mitigation:** per-group PRs + golden tests + manual device review.

**Acceptance:**
- [ ] `app_typography.dart` has ~21 named styles (15 canonical + 2 mono + 4 specialized)
- [ ] `app_theme.dart` has ~20 semantic tokens (12 main + 8 light/dark variants)
- [ ] No raw `Color(0xFF...)` outside the tokens (except slate scale)
- [ ] `flutter analyze` clean
- [ ] 33+ E2E tests pass
- [ ] No visual regression (golden test diff + manual screenshot review)
- [ ] `docs/design-system.md` updated

---

# PR-11 — R12 Dependabot / vulnerability SLA (1.5 hours)

**Per `docs/REMEDIATION_PLAN_2026-07-31.md` §R12:**

- [ ] **R12.1** Verify/create `.github/dependabot.yml` (5 min) — file exists, needs review
- [ ] **R12.2** Add `.github/workflows/dependency-audit.yml` — runs `npm audit --audit-level=high` on every PR (1 hr)
- [ ] **R12.3** Add `.github/workflows/flutter-pub-outdated.yml` — weekly Sunday run, reports via Slack (30 min)

**Why:** Security SLA per `SECURITY.md` §12 says "critical = 24h, high = 7d." Without CI enforcement, this is a paper SLA.

**Acceptance:**
- [ ] A new PR that introduces a high/critical CVE fails the build
- [ ] Slack channel receives weekly `flutter pub outdated` report
- [ ] `dependabot.yml` reviewed and either updated or confirmed-correct

---

# WAIT — 2026-08-06 staging soak finishes (passive, 1 week)

**Per `docs/REMEDIATION_PLAN_2026-07-31.md` §R1:**

5 migrations are deployed to staging. Daily monitoring (5 min/day) until 2026-08-06. Then ship the drop phase.

**What unblocks on 2026-08-06:**
- PR-J — drop legacy `pickupHub`/`currentPlan`/`teamLeader` string columns on Rider
- PR-K.3 — drop legacy `lifecycleStatus` enum (RiderLifecycleStatus → 5-value RiderLifecycleStage)
- PR-D.2 — drop legacy `Admin.permissions: String[]` column

**Daily check (5 min):**
```bash
# From the staging DB
psql $STAGING_DATABASE_URL -c "
SELECT count(*) AS unmapped_pickupHub FROM riders WHERE \"pickupHub\" IS NOT NULL AND \"pickupHubId\" IS NULL;
SELECT count(*) AS unmapped_currentPlan FROM riders WHERE \"currentPlan\" IS NOT NULL AND \"currentPlanId\" IS NULL;
SELECT count(*) AS unmapped_teamLeader FROM riders WHERE \"teamLeader\" IS NOT NULL AND \"teamLeaderId\" IS NULL;
"
# And check the app log for unexpected FK violations
tail -f /var/log/voltium/staging.log | grep -i 'foreign key\|constraint\|violates'
```

---

# PR-12 — R6 Drop legacy `Admin.permissions` column (0.5 day, post-soak)

**Per `docs/REMEDIATION_PLAN_2026-07-31.md` §R6:**

- [ ] **R6.1** Verify all readers/writers use the new `hasPermissions` relation (1 hr)
- [ ] **R6.2** Update admin use-cases to write to the relation (2 hr)
- [ ] **R6.3** Migration `20260806120000_drop_admin_permissions_legacy` (1 hr)
- [ ] **R6.4** Remove `permissions: String[]` from Prisma schema (10 min)
- [ ] **R6.5** Regression test `tests/unit/admin-no-legacy-permissions-column.test.ts` (1 hr)

**Why:** The `Admin.permissions: String[]` column has been backfilled to `AdminHasPermission` relation. The legacy column is only being read for fallback during the soak. Time to drop it.

**Acceptance:**
- [ ] `Admin.permissions` column dropped from `schema.prisma`
- [ ] All admin use-cases read/write via `hasPermissions` relation
- [ ] Migration is idempotent (guarded)
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run test:unit` clean

---

# PR-13 — R4 Flutter router state machine (1-2 weeks, 4 PRs)

**Per `docs/REMEDIATION_PLAN_2026-07-31.md` §R4:**

**Status:** R4.1 (sealed class) + R4.2 (go_router dep) + R4.3a (Riverpod Notifier) already shipped.

- [ ] **R4.3b** Migrate `AppShell` to go_router (1-2 d) — feature-flagged start
- [ ] **R4.4** Migrate auth flow to state machine (1-2 d) — `AuthRepositoryImpl.verifyOtp` returns `AppState`
- [ ] **R4.5** Scope polling to states (1 d) — `_onboardingPoller` only in `Onboarding`, etc.
- [ ] **R4.6** E2E tests + 5-10 new state machine tests + manual device smoke (1 d)

**Why this is highest risk:** it changes the entire navigation model. "Stuck on splash" / "stuck on pre-dashboard" bugs become impossible. But the change is invasive.

**Risk:** High. **Mitigation:**
- Feature flag the new router (`kRouterEnabled = false` default)
- Per-feature PR (Splash → LegalGate → AuthFlow → Onboarding → ActiveDashboard)
- 33+ e2e tests must pass before any manual smoke
- `setState` shell kept as backup for 1 release

**Acceptance:**
- [ ] `go_router` is the only navigation mechanism
- [ ] No `Navigator.push` / `Navigator.pop` calls remain
- [ ] `setState(() => _currentTab = ...)` is gone
- [ ] Polling lifecycle is state-scoped
- [ ] All 33+ e2e tests pass
- [ ] 5-10 new state machine unit tests pass
- [ ] Manual device smoke test passes (auth → onboarding → pre-dashboard → active-dashboard → logout)

---

# PR-14 — R10 Finish the ~70 remaining trivial items (1-2 days)

**Per `docs/REMEDIATION_PLAN_2026-07-31.md` §R10:** 15 of 120 done. Remaining ~70 are mostly:
- Custom analyzer rules (§6.6, §12.14)
- Observability v2 (Grafana dashboards, log shipping, RTO/RPO docs) — **explicitly deferred to v2, do not include**
- Various P2/P3 doc fixes
- "defer to v2" items

**Recommendation:** skip the v2-deferred items, do the analyzer rules + doc fixes in 1-2 focused days, file a single "v2 polish" ticket for the deferred items.

**Acceptance:**
- [ ] `flutter_coverage.sh` and `npm run test:coverage:combined` both ≥85% lines
- [ ] No new lint violations from the custom analyzer rules
- [ ] All §6.6, §12.14, and remaining P2 items have either shipped or filed v2 tickets

---

# Calendar

```
Week 1 (2026-07-31 to 2026-08-06):
├─ Mon     PR-1  (5 min) + PR-2.1-2.4 (1 hr) + PR-3 (10 min) + PR-4 (5 min) + PR-5 (10 min)
│          Total: ~1.5 hr
├─ Mon     PR-2.5-2.8 (2 hr) + PR-6 (1 hr)
│          Total: ~3 hr
├─ Mon     PR-7  R11 (0.5 d)
├─ Tue     PR-8  R8 (1 d)
├─ Wed     PR-9  R9 (1 d) + PR-11 R12 (1.5 hr)
├─ Thu-Fri PR-10 R2.1 typography (1-2 d)
└─ All wk  R1 soak monitoring (5 min/day)

Week 2 (2026-08-07 to 2026-08-13):  ← R1 soak finishes 2026-08-06
├─ Mon     PR-12 R6 (0.5 d) + R1.7/8/9 drop phase
├─ Tue-Fri PR-10 R2.2 colors (2-3 d)
└─ All wk  PR-14 R10 final polish (1-2 d)

Week 3-4 (2026-08-14 to 2026-08-27):
├─ Mon-Wed PR-13 R4.3b AppShell → go_router
├─ Thu-Fri PR-13 R4.4 auth flow migration
└─ W4      PR-13 R4.5 polling + R4.6 tests
```

**Ship-it-this-week (2026-08-06 cutoff):** PR-1 through PR-11 = ~5-6 focused days, all unblocked.

**Wait point:** 2026-08-06 (R1 soak finishes).

**Post-soak:** PR-12 (0.5 d) + PR-14 (1-2 d).

**Then:** PR-13 R4 (1-2 wks).

---

# Decision points to make before starting

1. **Untracked audit docs — same content as tracked, or different?**
   The SHA hashes I checked differ. Before trashing, run the diff and verify the tracked copy is the better one. If the untracked is better, promote it to `docs/`.

2. **PR-2.6 (Flutter CI keystore cleanup) — self-hosted runners or GH-hosted?**
   If self-hosted, the keystore is a real risk (it can be recovered later). If GH-hosted, the runner is destroyed but you should still clean up. Confirm before implementing.

3. **PR-2.8 (db-backup encryption) — which key management?**
   GPG key in env, or `gpg-agent` with a passphrase, or a server-side KMS? For 1 hour, GPG with the key in `BACKUP_GPG_KEY` env var is the simplest. Document the choice.

4. **PR-9 (Data-deletion Admin UI) — single button or 3 separate buttons?**
   The 3 actions (request/approve/restore) are different user roles. Recommend 3 buttons with role-based visibility.

5. **PR-13 R4.3b — feature flag default value?**
   Start with `kRouterEnabled = false` and flip per-feature. Or use a more sophisticated rollout (10% / 50% / 100%)? Recommend starting false, flipping per-feature.

6. **Trash the 5 staging-soak migrations too? No — they're in flight. Don't touch.**

---

# What to do right now (the next 5 minutes)

1. **Run PR-1**: commit the 5 test-infra files. 5 minutes. Closes the loop on the "fix the wonky test infra" ask.
2. **Run PR-2.1**: change "Ryd" to "Voltium" in `web/src/server/modules/auth/auth.use-cases.ts:52`. 5 minutes. Customer-visible win.

Everything else in this plan can wait until you've knocked those out.

---

# Out of scope (deliberately)

- v2 deferred work: Argon2id tuning, key rotation API, Grafana dashboards, admin 2FA, session management UI
- New features (admin UI for restore, etc.) — separate plan
- CI infrastructure improvements — already done 2026-07-29
- The 60+ raw color hues + 24 typography aliases (PR-10 R2.2 handles these)
- AppProvider migration (covered in R4)
- Server module size cap — already shipped (R5.3 is just the doc close-out)

---

# Cross-references

- **Master plan (this plan sits under this):** `docs/REMEDIATION_PLAN_2026-07-31.md`
- **Tickets:** `docs/FOLLOWUP_TICKETS.md` (65 tickets)
- **Audit verdicts:** `docs/AUDIT_VERIFICATION_3_2026-07-30.md` + `docs/AUDIT_VERIFICATION_4_2026-07-30.md`
- **Release status:** `docs/RELEASE_READINESS_2026-07-29.md`
- **What changed since:** `docs/REMAINING_WORK_2026-07-31.md` (the master "what's left" doc)
- **Per-audit plans:** `docs/{DB,DESIGN_SYSTEM,ADMIN_WEB,RIDER_APP,INFRASTRUCTURE,SECURITY}_PLAN.md`
- **Runbook:** `docs/RUNBOOK.md` (worker job types, deploy procedure, alerting setup)
- **Known issues:** `docs/KNOWN_ISSUES.md` (R8 + R9 close line 28)
- **Security plan:** `docs/SECURITY_PLAN.md` (PR-1 through PR-10 for the 10 security P0s)
- **Infra plan:** `docs/INFRASTRUCTURE_PLAN.md` (PR-1 through PR-10 for the 10 infra items)
