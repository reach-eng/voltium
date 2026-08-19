# Testing Strategy Deep Audit — Voltium (2026-08-08)

**Auditor:** This session
**Method:** Direct source inspection across web + Flutter + CI. Test count, type, location, and quality assessed.

---

## Executive Summary

| Layer | Files | Lines | Verdict |
|---|---|---|---|
| **Web unit** | 279 | ~43K | ✅ Solid, with 2 known-skipped tests masking real test-isolation bugs |
| **Web integration** | 76 | (in 43K) | ✅ Solid — uses real Postgres via testcontainers |
| **Web API** | 7 (in `tests/api/`) + `api-routes.test.ts` (live) | — | ⚠️ Live network tests require `npm run dev` to be running |
| **Web security** | 2 (PII + privilege escalation) | — | ✅ Both narrow but real |
| **Web load** | 5 k6 scripts | — | ✅ Wallet concurrency is the most relevant; rest are k6 templates |
| **Web E2E (Playwright)** | Windows-only workflow | — | ✅ Good coverage, but only on Windows runner |
| **Flutter unit** | 230 | ~18K | ✅ Solid |
| **Flutter widget** | 66 (largest category) | — | ✅ Solid |
| **Flutter golden (visual regression)** | 3 | — | 🔴 **3 are placeholder `return;` tests** — they pass trivially, count as 3 tests, test nothing |
| **Flutter integration (e2e_individual)** | 50 | ~6.4K | ⚠️ Numbering collisions; some "tests" are 2-line scaffolds; AGENTS.md claims 33/33 but actual is 50 |
| **Flutter integration (e2e)** | 9 (parallel directory) | — | ⚠️ Duplicate intent with e2e_individual — unclear which is canonical |
| **CI workflows** | 10 | — | ✅ Comprehensive: lint, typecheck, build, unit, integration, security, mutation (weekly), load (weekly) |
| **Coverage gate** | 85% line (web + Flutter) | — | ✅ Hard gate enforced; coverage merge script combines unit + integration |

**Overall:** The testing infrastructure is **mature, multi-layered, and competitive** with what a 10-engineer SaaS team would build. The 3 P0 issues below are about *test quality* (golden placeholders, dual e2e directories, skipped tests masking isolation bugs), not test *coverage*. The codebase has 100s of behavior-asserting tests with real Postgres isolation — this is a strength, not a weakness.

---

## Section 1: The 3 P0 Issues (Real Bugs in the Test Suite)

### T-P0-1: 3 golden tests are placeholders that pass by `return;`

**Severity:** 🚨 P0
**File:** `D:\voltium\flutter\test\features\dashboard\presentation\screens\dashboard_screen_golden_test.dart`, `profile_screen_golden_test.dart`, `wallet_screen_golden_test.dart`

```dart
void main() {
  // TODO: Golden test for DashboardScreen. The golden image at
  // `goldens/dashboard_screen_default.png` does not exist yet. Run
  // `flutter test --update-goldens ...` locally to generate it, then commit.
  testWidgets('DashboardScreen golden test (skipped — needs --update-goldens)',
      (WidgetTester tester) async {
    return;  // <-- exits the test function immediately
    configureGoldenSurface(tester, size: const Size(400, 800));
    // ... rest of the test never runs ...
  });
}
```

**Impact:** These files count as 3 passing tests in the CI report, but they don't actually test anything. A future contributor looking at "dashboard test is green" will assume the dashboard has visual-regression coverage. A goldens change that breaks the screen would not be caught.

**Recommended fix:**
- Either generate the golden images now (`flutter test --update-goldens`) and remove the `return;`, or
- Remove the test files entirely until the goldens are generated. The TODO scaffolding is misleading.

The harness itself (`test/helpers/golden_test_harness.dart`) is good — it's just the 3 tests that are placeholders.

---

### T-P0-2: 3 `it.skip` mask real test-isolation bugs in the test infrastructure

**Severity:** 🚨 P0
**Files:**
- `D:\voltium\web\tests\unit\money\transaction.repository.test.ts:41`
- `D:\voltium\web\tests\unit\money\deposit-ledger.service.test.ts:58`
- `D:\voltium\web\tests\unit\workers\dispatcher.integration.test.ts:107`

**Why they were skipped (from inline comments):**

```ts
// transaction.repository.test.ts:41
it.skip('returns paginated transactions with rupee conversion', async () => {
  // TODO: Test passes in isolation but fails in full suite because
  // setupTestPostgres() does `prisma db push --accept-data-loss` which
  // wipes data when other test files run their beforeAll. Needs proper
  // test isolation (e.g., per-file schema or transaction rollback).
});

// deposit-ledger.service.test.ts:58
it.skip('should upsert record', async () => {
  // TODO: Fails intermittently with "Can't reach database server" when
  // run as part of the full unit test suite. Root cause: shared Prisma
  // connection pool fills up across test files. See wallet.service.test.ts
  // for the same issue.

// dispatcher.integration.test.ts:107
it.skip('dispatcher scheduling loop uses injected clock ...', async () => {
  // TODO: Re-enable when worker dispatcher polling can be cleanly stopped.
  // Currently startWorkers() spawns a long-running setInterval polling loop
  // that doesn't exit on stopWorkers() within a reasonable test timeout.
});
```

**Impact:**
- **Two real test-isolation bugs are being hidden.** The 85% coverage gate is not catching them because the skipped tests don't run.
- Future contributors will be tempted to "skip on flake" as the pattern.
- The "shared Prisma connection pool" issue is a known production concern (the codebase has `pgbouncer` discussion in `docs/`) and the test suite is the right place to surface it.

**Recommended fix:**
- **`transaction.repository.test.ts` and `deposit-ledger.service.test.ts`:** Move to per-test-file schema. The `realistic/setup.ts` already does this — copy the pattern. Use a unique `schema=test_${filename}_${uuid}` and clean it up in `afterAll`. With schema isolation, `prisma db push` from one test file cannot affect another.
- **`dispatcher.integration.test.ts`:** The comment says "should be moved to tests/integration/worker-dispatcher.test.ts which already covers the processJobs backoff logic." So the test is redundant. Either delete it or implement the start/stop cleanly (e.g., accept a `pollingInterval` and a `stop()` Promise that resolves on the next poll).

---

### T-P0-3: Two parallel e2e directories with overlapping intent + numbering collisions

**Severity:** 🚨 P0 (process, not bug — but the user-facing impact is real)
**Files:**
- `D:\voltium\flutter\integration_test\e2e\` — 9 files: `auth_flow_test.dart`, `dashboard_test.dart`, `error_edge_cases_test.dart`, `full_journey_test.dart`, `onboarding_flow_test.dart`, `profile_test.dart`, `settings_test.dart`, `support_test.dart`, `wallet_test.dart`
- `D:\voltium\flutter\integration_test\e2e_individual\` — **50 files** (numbered 00–42, with multiple files sharing the same prefix)

**The collisions:**

```
e2e_individual/34_full_onboarding_to_dashboard_test.dart  (18994 bytes — real)
e2e_individual/34_guarantor_flow_test.dart                (7324 bytes — real)
e2e_individual/34_guarantor_form_test.dart                (3072 bytes — real)
e2e_individual/34_pickup_screen_test.dart                 (2554 bytes — real)  <-- PR-8 added

e2e_individual/35_admin_approval_wait_test.dart           (6244 bytes)
e2e_individual/35_emergency_sos_test.dart                 (2340 bytes)  <-- PR-9 added
e2e_individual/35_kyc_notification_test.dart              (4412 bytes)
```

**Plus 36/37/38/39/40/41/42 collisions** — every "phase 2" file has 1–3 siblings. The `run_phased_tests.sh` script (which the AGENTS.md doesn't actually reference — it's at `e2e_individual/run_phased_tests.sh`, not the top-level `integration_test/run_phased_tests.sh` that AGENTS.md mentioned) runs them by phase number, which works only if each phase has one test.

**AGENTS.md says "33/33 PASSING" but actual count is 50.** That's a 17-test drift between docs and reality.

**Impact:**
- CI count disagrees with the master audit's claim.
- The "one phase, one test" assumption in `run_phased_tests.sh` is broken.
- Future contributors don't know which of the parallel tests is canonical.

**Recommended fix:**
- Pick one directory as canonical. `e2e_individual/` is more granular and has the newer tests (PR-8/9 from this session); deprecate `e2e/`.
- Re-number the e2e_individual tests so each number has exactly one file. Move the older files (e.g. `34_full_onboarding_to_dashboard_test.dart` becomes `43_full_onboarding_to_dashboard_test.dart` to free up 34 for `34_pickup_screen_test.dart`).
- Update `run_phased_tests.sh` and `AGENTS.md` to match.

---

## Section 2: The 6 P1 Issues (Real, but lower urgency)

### T-P1-1: Some "tests" are 2-line scaffolds that always pass

**Severity:** 🔴 P1
**Example:** `D:\voltium\flutter\integration_test\pages\app_page.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class AppPageObject {
  final WidgetTester tester;
  AppPageObject(this.tester);
}
```

This is a helper, not a test — but if it's in `integration_test/e2e_individual/` with a similar shape, it gets counted. Let me note: the 50 count from earlier excluded non-`*_test.dart` files, so the page objects are correctly excluded. The 50 count is real test files.

**However:** some of the 50 e2e_individual tests are short and may be SEED-style "screen mounts" tests (per the prior session summary: "PR-8 and PR-9 are SEED integration tests — they assert the screen mounts and the test framework wiring is correct"). That's still 2 of 50. The other 48 should be more substantive.

**Recommended fix:** Verify the e2e_individual tests are actually asserting behavior, not just `expect(find.byType(X), findsOneWidget)`.

---

### T-P1-2: k6 load tests are weekly, not on PR

**Severity:** 🔴 P1 (latent risk)
**File:** `D:\voltium\.github\workflows\nightly-load.yml`

```yaml
name: Weekly Load Test
    - cron: '0 4 * * 0' # Sundays at 4:00 AM (after mutation tests)
```

k6 is the only place that exercises:
- Wallet concurrency under load (the most likely place to find race conditions)
- Outbox event throughput
- Top-up/deduct with parallel riders

A regression in the outbox or wallet would not be caught until the next Sunday. The wallet-concurrency-load.ts is the only one that targets a real-money path.

**Recommended fix:**
- Add a smoke k6 to the PR pipeline: 50 concurrent users for 1 minute. Cheap (< 5 min) and catches the worst regressions.
- Keep the deep weekly k6 as-is.

---

### T-P1-3: Playwright E2E is Windows-only

**Severity:** 🔴 P1
**File:** `D:\voltium\.github\workflows\e2e-windows.yml`

```yaml
name: Windows E2E Tests (Playwright & Flutter)
```

PR pipeline runs on `ubuntu-latest`. Playwright only runs on `windows-latest`. This means:
- A breaking change in the admin UI is not caught until the Windows E2E pipeline runs (which is independent of PR merge).
- Developers on Mac/Linux dev boxes can't run Playwright locally the same way CI does.

**Recommended fix:**
- Add a parallel `e2e-ubuntu.yml` that runs Playwright headless. WebKit + Chromium are the relevant browsers; Firefox is optional.
- This is mostly an infrastructure move; the tests already exist.

---

### T-P1-4: API coverage gap check is the only spec-coverage check

**Severity:** 🔴 P1 (low coverage scope)
**File:** `D:\voltium\web\scripts\check-api-coverage.js`

This script cross-references the OpenAPI spec (116 paths, 57 admin + 22 rider) against the test files. The exclusion list at the top is:

```js
const EXCLUSIONS = [
  '/api/health',
  '/api/internal',
  '/api/cron',
  '/api/metrics',
  '/api/monitoring/metrics',
  '/api/rider/register-token',
  '/api/files',
];
```

**Problem:** `/api/files` is excluded entirely. If the file upload/download flow breaks, no test catches it. `/api/cron` is excluded — cron jobs run on a timer and can't be integration-tested the same way, but a contract test (asserts the route exists and rejects invalid input) would still be useful.

**Recommended fix:** Reduce the exclusion list. `/api/files` is a real money-adjacent path (rider KYC docs, vehicle return photos) and should have at least one positive + one negative test.

---

### T-P1-5: 85% coverage gate is a line-coverage floor, not a meaningful test-quality bar

**Severity:** 🔴 P1 (process)
**File:** `D:\voltium\.github\workflows\ci-cd.yml`

```yaml
- name: Merge coverage & enforce 85% line coverage gate
  run: npm run test:coverage:merge
    MIN_COVERAGE: '85.0'
```

Line coverage at 85% catches "this function was never called" but not "this function was called with no assertions." The 3 placeholder golden tests (T-P0-1) demonstrate the gap: they call `configureGoldenSurface` and `pumpWidget` but the assertions never run, and they still count toward "test passed" with no coverage penalty because the lines after `return;` are unreached but the test still passes.

**Recommended fix:**
- Add a "no-trivial-tests" linter: parse each test file, count `it(`/`it.skip(`/`test(`/`testWidgets(` declarations, count `expect(`/`assert(` calls. Tests with 0 assertions and a `return;` should be flagged.
- Or: enforce a `expect/assert/tested behavior` ratio (e.g. ≥1 expect per test).

---

### T-P1-6: Test count "33/33" in AGENTS.md is wrong

**Severity:** 🔴 P1 (drift)
**File:** `D:\voltium\AGENTS.md`

```
#### Flutter E2E Tests (33/33 PASSING)
```

The actual count in `integration_test/e2e_individual/` is 50 files. The master audit's summary at `2026-08-07-master-audit-recheck.md` was correct at the time (33) but PR-8/9 added 2 more, and other sessions added more. The doc is stale.

**Recommended fix:** Update `AGENTS.md` to either:
- Reflect the actual count, or
- Replace the count with a CI badge that auto-updates.

---

## Section 3: What's Solid (the 8 strengths)

### T-S-1: Real Postgres via testcontainers in unit tests

**Severity:** ✅ Strong
**File:** `D:\voltium\web\tests\_setup\test-postgres.ts`

```ts
import { testDb } from '../../_setup/test-postgres';
await testDb.rider.create({ data: { id: riderDbId, ... } });
```

The unit tests don't use Prisma mocks — they use a real Postgres via testcontainers. This catches:
- Real SQL query bugs (Prisma mock would pass a broken query)
- Real transaction behavior
- Real concurrency / race conditions (where they're not skipped)

The downside (T-P0-2) is shared state across files, but the test-isolation pattern in `realistic/setup.ts` shows the team knows how to do per-schema isolation.

---

### T-S-2: Heavy use-case mocking with strict repository boundaries

**Severity:** ✅ Strong
**File:** `D:\voltium\web\tests\unit\use-cases.test.ts`

```ts
const mockKycRepository = {
  findByRiderId: vi.fn(),
  submitKyc: vi.fn(),
  approveKyc: vi.fn(),
  rejectKyc: vi.fn(),
  requestInfo: vi.fn(),
  savePartialKyc: vi.fn(),
};
```

Use cases are tested in isolation from repositories. The mock defines the contract — if a use case calls a method that doesn't exist on the repo, the test fails clearly. This is the right shape for testing orchestration logic.

---

### T-S-3: Page-object model for Flutter E2E

**Severity:** ✅ Strong
**File:** `D:\voltium\flutter\integration_test\pages\app_robots.dart` (1891 bytes), `wallet_page.dart` (1891), `pickup_page.dart`, etc.

The `pages/` directory has 11 page objects. Tests compose these instead of building widgets from scratch. This is the Page Object pattern done right — selectors + actions are reusable across tests.

The `app_robots.dart` (1891 bytes) is the "what can the app do" abstraction: `appRobots.dashboard.openWallet()`, `appRobots.login.enterPhone(...)`. This is the "robot pattern" from Flutter's official integration test docs. Solid.

---

### T-S-4: Chaos engineering tests for resilience

**Severity:** ✅ Strong
**File:** `D:\voltium\web\tests\integration\chaos.test.ts`

```ts
it('gracefully degrades on database connection drop', async () => {
  await db.$disconnect();
  try {
    const res = await fetch(`${BASE_URL}/api/vehicles?hubId=chaos-test-hub`);
    expect(res.status).toBeGreaterThanOrEqual(500);
    // ...
  } finally {
    await db.$connect();
  }
});
```

Forces a DB disconnect mid-test. Asserts the error handler returns 5xx (not a crash). This is the kind of test that catches "we forgot to wrap the route in a try/catch" before production does.

---

### T-S-5: CI pipeline covers 8 dimensions in parallel

**Severity:** ✅ Strong
**File:** `D:\voltium\.github\workflows\`

| Workflow | What it catches |
|---|---|
| `ci-cd.yml` | Lint, typecheck, build, unit, integration, security, coverage gate |
| `flutter-ci-cd.yml` | i18n + flutter test + coverage gate |
| `e2e-windows.yml` | Playwright on Windows + Flutter Android E2E |
| `mutation-nightly.yml` | Stryker mutation testing (weekly) |
| `nightly-load.yml` | k6 load (weekly) |
| `daily-smoke-tests.yml` | Daily smoke regression |
| `lighthouse-ci.yml` | Frontend performance |
| `dependency-audit.yml` | `npm audit` / dependency security |
| `secret-rotation-nightly.yml` | Verifies the secret rotation script works |
| `flutter-e2e-manual.yml` | Manual trigger for full E2E suite |

This is mature. The nightly/daily/weekly cadence means regressions don't pile up.

---

### T-S-6: Per-test UUID isolation prevents test data collisions

**Severity:** ✅ Strong
**File:** `D:\voltium\web\tests\unit\money\rental.repository.test.ts`

```ts
beforeEach(async () => {
  riderDbId = uuidv4();
  const riderId = `RD-${uuidv4().substring(0, 12)}`;
  const phone = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
  const referralCode = `REF-${uuidv4().substring(0, 12)}`;
  // ...
});
```

Every test creates a unique rider. The phone is random (10 digits, never collides). The referral code is UUID-derived. The pattern: a test can never be polluted by another test's leftover data.

---

### T-S-7: OpenAPI-driven coverage gap check

**Severity:** ✅ Strong
**File:** `D:\voltium\web\scripts\check-api-coverage.js`

The script parses the OpenAPI spec, walks every test file under `tests/integration/`, `tests/api/`, `tests/security/`, and `tests/api-routes.test.ts`, and reports which paths have no test reference. This is a real "spec coverage" check — not just line coverage but "every documented endpoint is exercised by at least one test."

The downside is the exclusion list (T-P1-4) hides some paths. But the mechanism is right.

---

### T-S-8: Stub golden test infrastructure is well-built

**Severity:** ✅ Strong (with the caveat from T-P0-1)
**File:** `D:\voltium\flutter\test\helpers\golden_test_harness.dart`, `golden_test_helper.dart`

The harness exists, the helpers exist, the screenshot infrastructure is in place. The 3 placeholder tests are not infrastructure problems — they're "no one has generated the goldens yet" problems. Generating 3 PNGs is a 5-minute task (one `flutter test --update-goldens` per file).

---

## Section 4: Coverage Map by Critical Path

| Critical path | Web tests | Flutter tests | Verdict |
|---|---|---|---|
| **Money: wallet topup** | ✅ `transaction.repository.test.ts`, `wallet-deposit_topup.test.ts`, `transaction-cas.test.ts` | ✅ `wallet_topup_test.dart`, `wallet_balance_test.dart`, `wallet_filters_test.dart` | Strong |
| **Money: deduct/refund** | ✅ `wallet-concurrency-load.ts`, `transaction_request.test.ts` | ✅ `rental_end_test.dart` | Strong |
| **Money: paise ↔ rupee conversion** | ⚠️ `it.skip` in `transaction.repository.test.ts:41` covers this | ✅ | Web has gap |
| **SOS / emergency** | ✅ `emergency-sos.test.ts` (the route), `tests/api/emergency-sos.test.ts` | ✅ `emergency_sos_test.dart` (PR-9), `emergency_contacts_service_test.dart` | Strong |
| **KYC submission** | ✅ `kyc_workflow.test.ts`, `kyc_validation_test.dart` | ✅ `kyc_validation_test.dart`, `user_onboarding_screen_test.dart` | Strong |
| **KYC review (admin)** | ✅ `KycDetailSheet` tests, `useKyc.test.ts` | n/a | Strong |
| **Login + OTP** | ✅ `verify-otp/route.ts` tests, `auth_negative.test.ts` | ✅ `login_screen_test.dart`, `otp_verification_test.dart`, `full_auth_login_test.dart` | Strong |
| **Consent (DPDP)** | ✅ `consent-persistence.test.ts`, `rider-consent/route.ts` | ✅ `consent_service_test.dart` (per `flutter test/services/`) | Strong |
| **Pickup flow** | ✅ `pickup_workflow.test.ts` | ✅ `pickup_screen_test.dart` (PR-8), `pickup_hub_screen_test.dart` | Strong |
| **Rental end** | ✅ `return_workflow.test.ts`, `rental-return-payload-compat.test.ts` | ✅ `rental_end_test.dart`, `end_rental_screen_test.dart` | Strong |
| **Admin role/RBAC** | ✅ `admin-permissions-shape.test.ts`, `privilege_escalation.test.ts` | n/a | Strong |
| **Logout (cross-account leak)** | ✅ `auth-fail-closed.test.ts` (server), `rider_provider_test.dart` (client) | ⚠️ `RiderLogoutOrchestrator` has no dedicated test (PR-3) | Flutter gap |
| **TLS pinning** | n/a | ⚠️ `pinned_http_client_test.dart` exists but only checks the debug-mode fallback | Acceptable — release throw is new |
| **P0-1 from master audit (NaN pagination)** | ✅ `earnings-query-params.test.ts` | n/a | Strong |
| **Outbox priority (interactive/background)** | ✅ `admin-jobs-priority.test.ts`, `job-queue-priority.test.ts` | n/a | Strong |
| **Outbox event emit rate limit (D-P1-9)** | ⚠️ **no test added for the new 1,000/min limit** | n/a | **Gap** |
| **Producer-side rate limit (D-P1-9)** | — | — | No test |
| **D-P0-1 TLS pinning release throw** | — | ⚠️ no test asserts the new throw behavior | **Gap** |
| **D-P1-6 logout encrypt-and-delete** | — | ⚠️ `RiderLogoutOrchestrator` has no test | **Gap** |

---

## Section 5: The 6 P2 Issues (Process / Polish)

### T-P2-1: `run_phased_tests.sh` is at a non-obvious path

The AGENTS.md says `flutter/integration_test/run_phased_tests.sh` but the actual file is at `flutter/integration_test/e2e_individual/run_phased_tests.sh`. Documentation drift.

---

### T-P2-2: Use-case test mock pattern not codified in a shared helper

`use-cases.test.ts` has 5 separate `mockKycRepository` / `mockGuarantorRepository` etc. with hand-written shapes. A `mockFactory.ts` that generates these from the repository's TypeScript type would prevent drift (when a real method is added, the test mock doesn't know to add the `vi.fn()`).

---

### T-P2-3: No pre-commit hook for tests

Test runs only happen in CI. A 3-minute feedback loop on a typo. A `pre-commit` or `lefthook` config that runs `flutter test --no-fatal-warnings` and `npm run lint:ts` on the staged files would be cheap insurance.

---

### T-P2-4: No "failing on flake" alert

`it.skip` is silently accumulating. A CI step that grep's the diff for new `it.skip` / `test.skip` lines and posts a Slack alert would force a conscious decision.

---

### T-P2-5: Wallet money tests have no "boundary value" coverage

E.g. "what if amountInPaise = 0?" or "what if amountInPaise = MAX_SAFE_INTEGER?" The math (`Math.ceil` / `Math.floor` in paise ↔ rupee conversion) has edge cases at the boundaries. A boundary-value test suite would catch off-by-one bugs.

---

### T-P2-6: `it.only` / `describe.only` not actively scanned for

The codebase may have `.only` markers in test files. None found in the spot-check, but a CI grep for `\.(only|todo|skip)\(` with a count threshold would be cheap.

---

## Section 6: Inventory Snapshot

### Web test files (279 unit + 76 integration + 7 API + 2 security + 5 load)

```
tests/
  _setup/                   1 file
  api/                      14 .test.ts (admin + rider subdirs)
  e2e/                      (Playwright specs)
  integration/              76 across 26 subdirs
  load/                     5 k6 scripts
  realistic/                1 setup.ts (per-file schema isolation pattern)
  security/                 2 .test.ts (PII leak + privilege escalation)
  unit/                     279 .test.ts (analytics, api, files, lib, money, scripts, server, workers)
  api-routes.test.ts        (live network tests against dev server)
  offline-store.test.ts
  smoke.test.ts
```

### Flutter test files (230 unit + 50 e2e_individual + 9 e2e + 11 page objects)

```
test/
  app/                      3
  auth/                     3
  core/                     2 (i18n, network, navigation, state — subdirs)
  dashboard/                4
  emergency/                3
  features/                 (28 subdirs mirroring lib/features/)
  golden/                   (no .dart files — folder for the .png goldens)
  guarantor/                2
  helpers/                  4 shared test helpers
  kyc/                      3
  models/                   6
  providers/                9
  repositories/             6
  services/                 16
  support/                  5
  theme/                    2
  tools/                    4
  utils/                    13
  wallet/                   6
  widgets/                  66 (largest category)
  workflows/                1

integration_test/
  e2e/                      9 (top-level, full-journey tests)
  e2e_individual/           50 (per-screen, 00-42 numbered with collisions)
  helpers/                  3
  pages/                    11 page objects
```

### CI workflows (10)

```
ci-cd.yml                   Lint, typecheck, build, unit, integration, security, coverage
flutter-ci-cd.yml           i18n + flutter test + coverage
e2e-windows.yml             Playwright on Windows + Flutter Android E2E
mutation-nightly.yml        Stryker weekly
nightly-load.yml            k6 weekly
daily-smoke-tests.yml       Smoke regression
lighthouse-ci.yml           Frontend perf
dependency-audit.yml        npm audit
secret-rotation-nightly.yml Secret rotation verification
flutter-e2e-manual.yml      Manual full E2E trigger
```

---

## Section 7: Recommended Fix Plan (Prioritized)

### Sprint 1 (this week) — the 3 P0s

1. **T-P0-1** Generate the 3 missing golden PNGs OR delete the 3 placeholder test files. 5 minutes of work either way. The test count goes from 50 → 47 (delete) or 50 → 50 (real).
2. **T-P0-2** Fix the 2 shared-Prisma-pool it.skip's by adopting the per-file schema pattern from `realistic/setup.ts`. This will require a helper file (e.g. `tests/_setup/per-file-schema.ts`) and migrating the affected test files. ~half day.
3. **T-P0-3** Pick a canonical e2e directory (`e2e_individual/`), deprecate `e2e/`, and re-number the colliding tests so each number is unique. Update `run_phased_tests.sh` and `AGENTS.md`. Half day.

### Sprint 2 — the 6 P1s

4. **T-P1-1** Sample-audit the 50 e2e_individual tests for the 2-line-scaffold pattern. Verify each test has at least one `expect`.
5. **T-P1-2** Add a smoke k6 to the PR pipeline (50 concurrent / 1 min). Update `nightly-load.yml` to keep the deep run.
6. **T-P1-3** Add an `e2e-ubuntu.yml` Playwright run.
7. **T-P1-4** Reduce the `EXCLUSIONS` list in `check-api-coverage.js` — start with `/api/files`.
8. **T-P1-5** Add a "no-trivial-tests" linter to the coverage gate. (Custom script: count `it(` / `test(` / `it.skip(` declarations and `expect(` calls per file.)
9. **T-P1-6** Update `AGENTS.md` to either reflect actual count or replace with a CI badge.

### Sprint 3 — the 6 P2s

10. **T-P2-1** Move `run_phased_tests.sh` to `integration_test/` (top-level) so the AGENTS.md path is correct.
11. **T-P2-2** Add `tests/_setup/mockFactory.ts` for repository mocks.
12. **T-P2-3** Add `lefthook.yml` (or `husky` + `lint-staged`) for pre-commit lint + flutter test.
13. **T-P2-4** Add a CI grep that alerts on new `it.skip` / `test.skip` in the diff.
14. **T-P2-5** Add a boundary-value test suite for paise ↔ rupee conversion.
15. **T-P2-6** Add a CI grep for `.only(` and `.todo(` in test files; fail on either.

### Tests to add for the new deep-audit fixes

These fixes from `2026-08-08-deep-audit-fixes.md` have no test coverage yet:

- **D-P0-1 TLS pinning throw in release** — add a test that calls `PinnedHttpClient.createClient()` in `kReleaseMode` and asserts the `StateError`. The current `pinned_http_client_test.dart` only tests the debug-mode fallback.
- **D-P1-9 Outbox emit rate limit (1,000/min)** — add a test that calls `OutboxService.emit` 1,001 times in a tight loop and asserts the 1,001st throws `OutboxEmitRateLimitedError`.
- **D-P1-6 Logout encrypt-and-delete** — add a test for `RiderLogoutOrchestrator.run()` that simulates a network logout failure and asserts `SecureStorageService.deleteRefreshToken` was called.

---

## Section 8: What I Did NOT Cover

- **The actual test runtime.** I didn't run `npm run test:unit` or `flutter test` to measure wall-clock. A slow test suite is itself a P1 problem.
- **Mutation testing output.** Stryker runs weekly; the most recent report wasn't checked. The mutation score is the real "test quality" bar — the 3 placeholder golden tests would have very low mutation scores.
- **CI cache strategy.** The workflows are configured for fresh runs; if test execution is slow, caching `node_modules` and `~/.pub-cache` would help.
- **Visual-regression tooling beyond golden tests.** No percy / chromatic / browsershots. Out of scope but worth noting.
- **Test data factory pattern.** Some tests hand-write uuids; a `testFactory.rider()` helper would reduce noise.

These are good follow-up audit passes if the user wants them.

---

## Section 9: User-Visible Summary (in plain terms)

**The good news:** This codebase has a serious testing setup. 8 dimensions of CI, real Postgres in unit tests, mutation testing weekly, k6 load weekly, OpenAPI-driven coverage gap check, 5-nightly cadence, the works. Most teams never build this.

**The 3 things that actually need fixing:**

1. **3 Flutter "golden" tests are placeholders** — they pass because they `return;` before any assertion. Looks like 3 tests in the count, tests nothing. Either generate the goldens or delete the files.

2. **3 web tests are skipped because of a real test-isolation bug** — the `it.skip` comments are candid ("fails in full suite because setupTestPostgres() does `prisma db push --accept-data-loss` which wipes data when other test files run"). The team knows. The fix is the per-file schema pattern already used in `realistic/setup.ts` — copy it.

3. **Two parallel e2e directories with numbering collisions** — `e2e/` (9 files) and `e2e_individual/` (50 files) overlap. The `e2e_individual/run_phased_tests.sh` assumes one file per phase number, but there are 4 files starting with "34_", 3 with "35_", etc. AGENTS.md says 33/33 passing; actual is 50. Doc drift.

**The 6 P1 issues are about test quality gates, not test existence.** Line coverage at 85% doesn't catch the placeholder tests, doesn't catch the skipped tests, doesn't catch a missing k6 on PR. The pipeline is mature; the gates could be more honest.

**Bottom line:** the test suite is the strong point of this codebase. The 3 P0s are about *quality* not *quantity* — and they're each less than a day's work.
