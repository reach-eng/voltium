# Remaining Backlog — Start-to-Finish Execution Plan (2026-08-26)

**Parent plan:** `docs/REMEDIATION_PLAN_2026-08-21.md` + status addendum (2026-08-26 execution run: 5 commits, all gates green)
**Current branch:** `fix/admin-finance-p0-2-p0-3-rowlock-bulk-2026-08-24`
**Current HEAD:** `ec6700f2` (web) + parallel Flutter commits through `25af0611`
**This plan's scope:** *only* the items the addendum calls **"Remaining open (exact)"** — nothing already landed, nothing speculative.

---

## 1. Executive Summary

| What | Detail |
|---|---|
| **Remaining code work** | **4 items** — 2 pure refactors + 1 hygiene bundle + 1 env-gated verification bundle |
| **New migrations** | **0** — both remaining code items are file moves / in-file refactors |
| **Total dev effort** | **~3.5 days** (1 engineer, sequential) · **~2 days** (2 engineers, parallel on F-062 ×3) |
| **Risk** | **Low** — all changes are behavior-preserving moves or test-only verification; every step is gated by `typecheck` + `lint` + `test:unit` |
| **Deliverable** | Plan branches merge cleanly → both `admin panel fully correctly populated` and `app fully correctly populated` gates stay green, plus hygiene |

### The 4 remaining items (nothing else)

| # | ID | One-liner | Kind |
|---|---|---|---|
| 1 | **F-062** | Split 3 oversized modules (>25 KB) into focused sub-modules | Refactor |
| 2 | **N4** | Delete `flutter/lib/services/voltium_api_service.dart` (241 lines, 28 delegating methods, 17 importer files) and rewire callers to `VoltiumApiClient` | Refactor |
| 3 | **H-01** | Cross-cutting hygiene: root junk, hook dedupe, `graphify update` | Chore |
| 4 | **V-01** | Env-gated verification: integration/API suites, coverage pipelines, Playwright + 49 emulator E2E | Verification |

Deferred/optional items from the parent plan are **explicitly out of scope** here: L-1 editor≠publisher permission split, FL-12 SPKI pinning upgrade, pricing/settings dormant-endpoint wire-or-delete decision — all flagged optional in § 1.

---

## 2. Pre-Flight (15 min, do once)

```bash
# From repo root — confirm you start from the addendum HEAD and a clean tree
git status --short                # must be empty
git log --oneline -3              # ec6700f2 should be HEAD
git checkout fix/admin-finance-p0-2-p0-3-rowlock-bulk-2026-08-24
git pull --ff-only

# Gates must be green before you touch anything
npm --prefix web run typecheck
npm --prefix web run lint
npm --prefix web run test:unit    # expect 3276 passed / 3 skipped
flutter analyze --no-pub          # flutter/ — expect "No issues found"
flutter test --no-pub             # expect 1654 passed
```

Single-writer rule (AGENTS.md): declare your file list before staging; `git status` before `git add`; commit small and often.

---

## 3. Work Breakdown

### 3.1 F-062 — Split 3 oversized modules (1.5 days)

All three are *mechanical* splits — no behavior change, no new logic. Goal: no file > ~15 KB, each sub-module has a single responsibility and is directly importable without re-export shims.

#### 3.1.1 `web/src/server/modules/data-management/backup.service.ts` (33 KB)

| Sub-module | Extract | Approx. lines |
|---|---|---|
| `backup.validation.ts` | `assertBackupPathAllowed`, `validateBackupSchedule` (N-3 containment logic) | ~60 |
| `backup.storage.ts` | `calculateDirSizeCached`, `DIR_WALK_BUDGET`, `dirSizeCache`, `getStorageOverview` (I-7) | ~110 |
| `backup.checksum.ts` | `hashFile` stream helper + `generateChecksums` (I-9 stream hashing) | ~45 |
| `backup.service.ts` (remaining) | Orchestration: `createBackup`, `acquireLock`/`releaseLock`, `reapStaleBackupJobs`, `applyRetentionPolicy` | ~14 KB |

**Steps:**
1. Create the 3 new files with the extracted functions (copy verbatim, fix relative imports).
2. Re-export nothing from the old barrel — update the 3–4 internal importers to point at the new sub-modules (grep `from '@/server/modules/data-management/backup.service'`).
3. `npm --prefix web run typecheck && npm --prefix web run test:unit -- data-management` — 15/15 must stay green.

#### 3.1.2 `web/src/server/modules/riders/admin-riders.use-cases.ts` (34 KB)

| Sub-module | Extract |
|---|---|
| `admin-riders.wallet.ts` | `balanceInPaise` handling + nonce-based idempotency (R-7c, W7) |
| `admin-riders.kyc-patch.ts` | KYC PII `encryptKycData` patch path (R-2) + `flatten-rider` field sets |
| `admin-riders.lifecycle.ts` | `transitionRiderStatus` wrapper + `lifecycle-ranks` reconciliation (R-1) |

Keep `adminRiderUseCases` as a thin facade re-exporting the 3 sub-objects so existing importers don't churn. Test file `rider-lifecycle-w7.test.ts` imports the facade — no change.

#### 3.1.3 `web/src/server/modules/riders/rider.use-cases.ts` (28 KB)

Split along the existing section comments:

| Sub-module | Extract |
|---|---|
| `rider.profile.ts` | `getProfile`, `updateProfile`, `flattenRider` wallet field block |
| `rider.wallet-ops.ts` | `getWallet`, `topUp` helpers |

Same facade pattern. Verify `web/tests/unit/api/rider-legal.test.ts` and `legal-lifecycle.test.ts` still import cleanly.

**F-062 commit strategy:** one commit per sub-file (3 commits) + one commit deleting the dead code. Each commit gates on `typecheck && lint && test:unit` (full suite, not just targeted).

---

### 3.2 N4 — Delete `flutter/lib/services/voltium_api_service.dart` (1 day)

**File to delete:** `flutter/lib/services/voltium_api_service.dart` — 241 lines, 28 methods, all of the form:
```dart
Future<X> foo(Y req) => _apiClient.someMethod(req.toJson()).then(X.fromJson);
```

**17 importer files** (verified 2026-08-26):
```
lib/app/router.dart
lib/core/network/api_client.dart
lib/core/state/riverpod_providers.dart
lib/features/dashboard/presentation/providers/engagement_provider.dart  # already migrated for FL-1
lib/features/device_compliance/presentation/screens/emergency_sos_screen.dart
lib/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart
lib/features/onboarding/presentation/screens/legal_screen.dart
lib/features/pickup/presentation/screens/pickup_hub_screen.dart (5 call sites)
lib/features/pickup/presentation/screens/pickup_verification_screen.dart
lib/features/profile/presentation/screens/earnings_screen.dart (2)
lib/features/profile/presentation/screens/edit_profile_screen.dart (3)
lib/features/profile/presentation/screens/settings_screen.dart (3)
lib/features/referrals/presentation/screens/referral_screen.dart
lib/features/rentals/data/repository_impl.dart
lib/features/rentals/presentation/screens/choose_plan_screen.dart (2)
lib/features/rentals/presentation/screens/end_rental_screen.dart
```

**Per-file migration (mechanical, repeat for each):**

1. `grep -n "voltium_api_service\|VoltiumApiService\|voltiumApiServiceProvider" lib/<file>.dart` — note method names used.
2. Replace import: `import '.../voltium_api_service.dart'` → `import '.../core/network/generated/api_client.dart'` (or `api_client.dart` for raw paths — check which the method delegates to).
3. Replace provider read: `ref.read(voltiumApiServiceProvider)` → `ref.read(voltiumApiClientProvider)` (+ `. _client` if raw path).
4. Replace call: `service.fetchPlans()` → `client.getRiderPlans()` (1:1 name map — see table in `voltium_api_service.dart:20-240`).
5. Adjust response handling: service methods that did `.then(X.fromJson)` now return `X` directly from the generated client — callers that did `res['data']` need `res.field` instead. Check each call site's `res.` usage.

**Order:** migrate in dependency order — `riverpod_providers.dart` first (provider definition), then leaf screens. Commit per 4–5 files.

**Gates per batch:**
```bash
flutter analyze --no-pub
flutter test --no-pub   # 1654 must stay green; engagement_provider_test covers FL-1 parity
```

**Final step:** `rm flutter/lib/services/voltium_api_service.dart` + remove its provider from `riverpod_providers.dart`. `flutter analyze` must report 0 imports of the deleted file (`grep -r voltium_api_service flutter/lib` → 0 hits).

---

### 3.3 H-01 — Cross-cutting hygiene (0.5 day)

All changes are deletions / config edits — no logic.

| Task | Action | Verification |
|---|---|---|
| Root junk | `git rm` tracked: `screen*.png`, `task.md`, `walkthrough.md`, superseded `AUDIT_rider_app.md` (keep `AGENTS.md`). Untracked: add to `.gitignore`: `*.zip`, `.dev-server-*`, `nul` + `rm voltium_project_review.zip` (93 MB) | `git status` clean; `ls` root shows only docs-standard files |
| Hook dedupe | Choose **lefthook** (already has `lefthook.yml` + format/typecheck hooks) and remove `.husky/` (or vice versa — team decision). This plan assumes lefthook wins: `rm -rf .husky && git rm -r .husky` | `cat .husky/pre-commit` gone; `npx lefthook install` succeeds |
| Graph | `graphify update .` | `graphify-out/GRAPH_REPORT.md` timestamp = today |

**Commit:** single `chore(hygiene): ...` commit. No code gates beyond `typecheck && lint`.

---

### 3.4 V-01 — Env-gated verification (0.5 day, needs a running dev server + emulator)

This is *verification*, not code, except for any reds it surfaces.

| Suite | Command | Requires | Gate |
|---|---|---|---|
| Web integration | `npm --prefix web run test:integration` | `npm --prefix web run dev` on :8081 + seeded DB (`npm --prefix web run db:seed`) | 0 failed |
| Web API routes | `npm --prefix web run test:api` | same dev server | 0 failed |
| Web coverage | `npm --prefix web run test:coverage:combined` | dev server for integration half | ≥85% lines |
| Flutter coverage | `bash flutter/scripts/flutter-coverage.sh` | none | ≥85% |
| Flutter E2E | `bash flutter/integration_test/e2e_individual/run_phased_tests.sh emulator-5554` | emulator-5554 booted (`flutter emulators --launch` + `flutter run --dart-define=API_URL=http://10.0.2.2:8081`) | 49/49 |

**If any suite reds:** fix the product code (not the test) and re-run that suite only. Do not mark V-01 done until the red is owned by a follow-up ticket.

---

## 4. Sequencing & Dependencies

```
Phase 0 (done) ──► everything below

F-062 (3.1) ─┐
             ├─► can run in parallel — no overlapping files
N4  (3.2) ───┘

Both above ──► H-01 (3.3) — hygiene touches root/.husky only, safe to run in parallel too but
              keep it last to avoid merge noise

All code work ──► V-01 (3.4) — verification needs the final code
```

**Recommended calendar (1 engineer):**

| Day | Work | Commits |
|---|---|---|
| **Day 1 AM** | F-062 backup.service split (3.1.1) | 1 |
| **Day 1 PM** | F-062 admin-riders + rider splits (3.1.2 + 3.1.3) | 2 |
| **Day 2** | N4 service deletion — 17 files in 3 batches (3.2) | 3 |
| **Day 3 AM** | H-01 hygiene + graphify (3.3) | 1 |
| **Day 3 PM** | V-01 env-gated suites (3.4) — fix any reds | 0–1 |

With 2 engineers: Day 1 parallelizes F-062 ×3 + N4 batch 1.

---

## 5. Branch & Commit Discipline

- Stay on `fix/admin-finance-p0-2-p0-3-rowlock-bulk-2026-08-24` (current branch per §2). Do **not** fork a new branch — the single-writer rule is per top-level area and this branch already holds the addendum HEAD.
- **Commit granularity:** one commit per sub-task above (7–8 commits total). Message format: `refactor(remediation): F-062 ...` / `refactor(flutter): N4 ...` / `chore(hygiene): ...` with `tickets per docs/AUDIT_BACKLOG.md` trailer (repo rule).
- **Pre-commit hook:** `lint + typecheck` runs automatically (lefthook/husky) + `dart format` for Flutter — expect `Formatted 592 files (0 changed)` noise; ignore.
- **Staging:** `git add <explicit file list>` — never `git add -A` (avoids sweeping the other writer's `FLUTTER_MENU_SCREENS_VERIFICATION` doc).

---

## 6. Verification Gates (run after every commit)

```bash
# Web — always
npm --prefix web run typecheck
npm --prefix web run lint
npm --prefix web run test:unit          # full 346-file suite; expect 3274/3 passed/skipped

# Flutter — after any 3.2 change
flutter analyze --no-pub
flutter test --no-pub                   # 1654 passed

# After 3.4 (env-gated — needs dev server + emulator)
# See §3.4 table for exact commands
```

No PR merges until its gate is green.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| F-062 splits break tests that mock the facade | Keep facade re-exports (`adminRiderUseCases.*` still works); grep `admin-riders.use-cases` importers before deleting |
| N4 response-shape drift (`res['data']` → `res.field`) | Check each call site's `res.` usage before replacing; `flutter analyze` catches type errors; `flutter test` catches provider wiring |
| `graphify update` dirty graph files | Expected — dirty graph files are not a reason to skip graphify per AGENTS.md |
| Shadow-DB blocked migrations | Use the `db execute + migrate resolve --applied` pattern proven for `legal_draft_publish` and `guarantor_rejection_reason` (2026-08-26) — do not touch the two gated Aug-6 legacy-drop migrations |
| Working-tree `nul` file on Windows | `rm` needs `Remove-Item -LiteralPath .\nul -Force`; verify with `Test-Path -LiteralPath .\nul` |

---

## 8. Definition of Done

- [ ] `web/src/server/modules/data-management/backup.service.ts` ≤ 15 KB and no file in `server/modules/**` > 15 KB
- [ ] `grep -r "voltium_api_service" flutter/lib` → 0 hits; `flutter analyze` clean; `flutter test` 1654 green
- [ ] `git ls-files | grep -E 'screen\.png|task\.md|walkthrough\.md'` → empty; `ls .husky` **xor** `ls lefthook.yml` (exactly one hook system)
- [ ] `graphify-out/GRAPH_REPORT.md` mtime = today
- [ ] V-01 table: all 5 suite rows green (or reds triaged to tracked tickets)
- [ ] Both `app fully correctly populated` and `admin panel fully correctly populated` gates still green (`docs/REMEDIATION_PLAN_2026-08-21.md` §§ Data-population gate / Admin data-population gate)

---

## 9. Out of Scope (explicitly not in this plan)

- L-1 editor≠publisher permission split (`legal_publish` descriptor) — optional follow-up noted in `legal.use-cases.ts`
- FL-12 SPKI pinning upgrade — optional flagged in Phase F4
- Pricing/settings dormant-endpoint wire-or-delete decision — product decision in Phase F5
- Any new feature work

---

*Generated 2026-08-26 from `docs/REMEDIATION_PLAN_2026-08-21.md` status addendum. Execute top-to-bottom; check off §8 as you go.*
