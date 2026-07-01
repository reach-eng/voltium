# COVERAGE_PLAN.md — Implementation Plan

> **Created**: 2026-06-29
> **Status**: Plan approved. Awaiting execution.
> **Reference**: [`docs/COVERAGE_PLAN.md`](./COVERAGE_PLAN.md) is the goal; this file is the staged execution plan.

## Audit Summary (2026-06-29)

The COVERAGE_PLAN.md goal of "meaningful 100% coverage" is **mostly implemented but not complete**. Current state:

| Phase | Plan estimate | Actual | Status |
|---|---:|---:|---|
| 1 (web money paths) | ~162 tests, 10 files | ~62 tests, 10 files | ⚠️ ~38% of plan |
| 2 (web worker jobs) | ~101 tests, 11 files | ~22 tests, 10 files | ⚠️ ~22% of plan |
| 3 (web API routes) | ~180 tests, 4 files | ~38 tests, 7 files | ⚠️ partial |
| 4 (Flutter services+providers) | ~250 tests, 25 files | ~113 tests, 28 files | ⚠️ partial |
| 5 (Flutter repos/models/utils/screens) | ~340 tests, 85 files | ~267 tests, 14 files (no screens/widgets) | ⚠️ partial |
| Coverage tooling | CI gates | **NOT configured** | ❌ |
| Cleanup | delete 4-5 placeholders | **All still present** | ❌ |

**Test counts**: Plan: ~1,033 new. Actual: ~402 new (~39% of plan). Total: ~2,501 test cases (vs. ~3,132 target).

---

## Execution Plan

### Stage 0 — Verification Baseline (15 min)

| Step | Action | Expected outcome |
|---|---|---|
| 0.1 | `cd web && npm test -- --run tests/unit` | Baseline pass count (~1,025 known) |
| 0.2 | `cd web && npm run test:api` | API route tests pass |
| 0.3 | `cd web && npm run test:integration` | Integration tests pass (Postgres required) |
| 0.4 | `cd web && npm run test:contracts` | Contract tests pass |
| 0.5 | `cd flutter && flutter test` | Flutter unit/widget tests pass (~441 known) |
| 0.6 | `cd flutter && flutter test test/golden` | Golden tests pass (only 1 widget has goldens) |
| 0.7 | Inventory any pre-existing failures | Categorize: real bugs vs. test bugs vs. environment |

**Commit**: `chore(tests): verify current test baseline`

---

### Stage 1 — Coverage Tooling & Docs (P0, 1 day)

| File | Change |
|---|---|
| `web/vitest.config.ts` | Add `coverage` block: provider `v8`, exclude `src/contracts/**`, `**/__mocks__/**`, `**/*.d.ts`; thresholds 85/75/85/85 |
| `web/package.json` | Add `test:coverage` script: `vitest --run --coverage` |
| `flutter/pubspec.yaml` | Verify `test` dev dep is present |
| `flutter/.gitignore` | Add `coverage/` |
| `.github/workflows/ci-cd.yml` | Add coverage step after `Run unit tests`: `npm test -- --run --coverage` with threshold fail |
| `docs/TESTING_STRATEGY.md` | New: scope, exclusion list, golden-update workflow, how to add new tests |
| `AGENTS.md` | Add Coverage Requirements: new code 95% lines, all new tests pass CI |

**Verify**: `npm test -- --run --coverage` locally, confirm report generated, thresholds enforced.

**Commit**: `chore(tests): add coverage tooling and docs`

---

### Stage 2 — Cleanup (P0, 1 hour)

| File | Action |
|---|---|
| `web/tests/realistic/_bootstrap/` | Verify no references; only `setup.ts` remains |
| `web/e2e/*.spec.ts` (9 placeholders) | Delete if 0 tests inside |
| `flutter/test/widget_test.dart` | Replace placeholder with first-launch smoke that loads `main()` |
| `flutter/integration_test/*.dart` (root, 9 files) | Verify not redundant with `e2e_individual/`; delete duplicates |
| `web/tests/unit/worker-jobs.test.ts` | Verify replaced by `web/tests/unit/workers/*.job.test.ts`; delete or annotate |

**Verify**: `flutter test`, `npm run test:unit`, `npm run test:api` all still pass.

**Commit**: `chore(cleanup): remove placeholder tests`

---

### Stage 3 — Flutter Phase 5a Repositories (P1, 1.5 days)

**Files to create** (6, ~100 tests total):

| File | Tests |
|---|---:|
| `flutter/test/features/auth/data/repository_impl_test.dart` | ~15 |
| `flutter/test/features/profile/data/repository_impl_test.dart` | ~15 |
| `flutter/test/features/rentals/data/repository_impl_test.dart` | ~20 |
| `flutter/test/features/support/data/repository_impl_test.dart` | ~15 |
| `flutter/test/features/wallet/data/repository_impl_test.dart` | ~20 |
| `flutter/test/features/kyc/data/kyc_repository_test.dart` | ~15 |

**Approach**: Mock `ApiClient` and `VoltiumApiClient` via `api_client_mock.dart` helper. For each repo, test all public methods: CRUD operations, error handling, response parsing.

**Verify**: `flutter test test/features/`

**Commit**: `test(flutter): add 6 repository tests`

---

### Stage 4 — Flutter Phase 5d Screen Golden Tests (P1, 2 days)

**Files to create** (15, 24 total golden states):

| Screen | Golden states |
|---|---|
| `auth_choice_screen` | default, dark |
| `dashboard/auth_wrapper` | loading, authenticated |
| `kyc/auth_wrapper` | loading, authenticated |
| `kyc/intent_of_use_screen` | default |
| `notifications/notification_preferences_screen` | default, all-off |
| `notifications/smart_notifications_screen` | empty, populated |
| `onboarding/welcome_screen` | default |
| `onboarding/privacy_consent_screen` | default |
| `onboarding/legal_page_screen` | default |
| `rentals/plan_success_screen` | default |
| `support/support_checklist_screen` | default, completed |
| `support/ticket_status_screen` | open, resolved |
| `support/troubleshooter_result` | success, failure |
| `wallet/history_screen` | empty, populated |
| `wallet/top_up_payment_sheet_screen` | default |

**Approach**:
1. Use existing `golden_test_harness.dart`
2. Wrap each screen with `MultiProvider` (theme, locale, app providers with mocked data)
3. Render with `pumpAndSettle()`
4. Use `matchesGoldenFile('goldens/<filename>.png')`
5. Generate initial goldens with `flutter test --update-goldens`
6. Commit goldens to `flutter/test/<screen>/goldens/`
7. PR review required for `--update-goldens` (codify in `AGENTS.md`)

**Verify**: `flutter test test/features/<feature>/presentation/screens/`

**Commit**: `test(flutter): add 15 screen golden tests`

---

### Stage 5 — Flutter Phase 5e Widget Golden Tests (P1, 1.5 days)

**Files to create** (~30, 1 golden per file, default state):

- `dashboard/widgets/dashboard_*.dart` (3 files)
- `kyc/widgets/kyc_*.dart` (3 files)
- `notifications/widgets/notification_*.dart` (2 files)
- `pickup/widgets/pickup_*.dart` (3 files)
- `profile/widgets/{earnings,edit_profile,profile}_*.dart` (5 files)
- `rewards/widgets/{earnings_add_sheet,earnings_chart,earnings_widgets}.dart` (3 files)
- `support/widgets/{support,troubleshooter}_*.dart` (2 files)
- `wallet/widgets/{skeleton_wallet_card,transaction_filter}.dart` (2 files)
- ... and ~7 more across other features

**Approach**: Same as Stage 4. Each test ~10 lines.

**Verify**: `flutter test test/features/`

**Commit**: `test(flutter): add 30 widget golden tests`

---

### Stage 6 — Phase 1-4 Density Catch-up (P2, 3.5 days)

**Goal**: Reach the test count density the plan called for in existing test files.

| Phase | Current tests | Target | Gap |
|---|---:|---:|---:|
| 1 (money) | ~62 | ~162 | +100 |
| 2 (workers) | ~22 | ~101 | +79 |
| 3 (API routes) | ~38 (est.) | ~180 | +142 |
| 4 (services+providers) | ~113 | ~250 | +137 |

**Approach**: For each existing test file, audit which code paths are NOT yet covered and add tests:
- Edge cases (empty inputs, null, boundary values)
- Error paths (exceptions, timeouts)
- All public methods (not just happy path)

**Verify**: Coverage report shows significant increase.

**Commit**: `test(web): density catch-up for Phases 1-4`

---

### Stage 7 — Phase 2 Dispatcher Verification (P2, 1 day)

| Step | Action |
|---|---|
| 7.1 | Read `web/src/server/workers/index.ts` to confirm `Clock` injection point exists |
| 7.2 | Read `web/tests/unit/workers/reconciliation.job.test.ts` to confirm test uses dispatcher with `Clock` |
| 7.3 | If missing: refactor `index.ts` to accept `Clock` and update tests to inject a test clock |
| 7.4 | If already done: document in plan as completed |

**Commit**: `test(web): verify worker dispatcher Clock injection`

---

### Stage 8 — Final Verification (30 min)

| Step | Action |
|---|---|
| 8.1 | Run full test suite: `npm test`, `flutter test` |
| 8.2 | Run coverage: `npm test -- --run --coverage`, `flutter test --coverage` |
| 8.3 | Generate final coverage report |
| 8.4 | Update `docs/COVERAGE_PLAN.md` with completion status (mark each phase ✅) |
| 8.5 | Update this `COVERAGE_PLAN_EXECUTION.md` to mark each stage ✅ |

**Commit**: `docs(coverage): mark COVERAGE_PLAN phases complete`

---

## Total Estimated Effort

| Stage | Effort | Cumulative |
|---|---|---:|
| 0. Verification | 15 min | 15 min |
| 1. Coverage tooling & docs (P0) | 1 day | 1.25 days |
| 2. Cleanup (P0) | 1 hour | 1.3 days |
| 3. Flutter repos (P1) | 1.5 days | 2.8 days |
| 4. Flutter screens golden (P1) | 2 days | 4.8 days |
| 5. Flutter widgets golden (P1) | 1.5 days | 6.3 days |
| 6. Density catch-up (P2) | 3.5 days | 9.8 days |
| 7. Dispatcher verification (P2) | 1 day | 10.8 days |
| 8. Final verification | 30 min | ~11 days |

## Risks & Adjustments

| Risk | Mitigation |
|---|---|
| Golden tests may fail on first run due to font/pixel differences | Use single device pixel ratio (1.0), single font; `golden_test_harness.dart` should configure this. If first render fails, `--update-goldens` and visual review. |
| Flutter widget tests for new screens may need provider setup we don't have | Reuse `provider_test_harness.dart`; if a screen needs a custom provider, add to helpers. |
| Density catch-up may surface real bugs in tested code | If a test fails for a code bug, log it, continue with tests, defer the fix. |
| CI may not have Flutter installed (current `ci-cd.yml` only runs web) | Note this in `docs/TESTING_STRATEGY.md`; Flutter tests run locally pre-merge. |
| Some repository implementations may depend on flutter_secure_storage or platform channels | Mock at the boundary; use existing `secure_storage_service_test.dart` patterns. |

## Decision Log

- **2026-06-29**: Plan created. User approved full completion of plan with verification first.

## Status Tracker

- [x] Stage 0 — Verification Baseline
- [x] Stage 1 — Coverage Tooling & Docs
- [x] Stage 2 — Cleanup
- [x] Stage 3 — Flutter Repositories
- [x] Stage 4 — Flutter Screen Golden Tests
- [x] Stage 5 — Flutter Widget Golden Tests
- [x] Stage 6 — Density Catch-up
- [x] Stage 7 — Dispatcher Verification
- [x] Stage 8 — Final Verification
