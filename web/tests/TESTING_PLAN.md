# Voltium Testing Plan

## Context

| Aspect | Current State |
|---|---|
| Web unit tests | ~1,025 passing across 38 files |
| Web integration tests | 219 across 33 files |
| Web API route tests | 53 across 4 files |
| Web contract tests | 12 (openapi validator) |
| Web security tests | 7 across 2 files |
| Web Playwright E2E | 138 across 41 specs |
| Flutter widget/unit tests | 441 across 58 files |
| Flutter integration tests | 84 across 45 files (e2e_individual) + 96 across 9 (e2e) + 24 root |
| **Total automated** | **~2,099 test cases** |
| Architecture | Route handler → use-case → repository → Prisma/Postgres |
| CI | Ubuntu, Node 20, no Docker, Postgres 16 as service |
| Flutter platforms | Android, iOS (33+ e2e tests) |

---

## Phase 1 — CI Integration Test Pipeline

**Goal**: All integration & API route tests run in CI against a live dev server.

### 1a. CI Postgres
Postgres 16 configured as CI service:
```yaml
services:
  postgres:
    image: postgres:16
    env:
      POSTGRES_USER: voltium_test
      POSTGRES_PASSWORD: voltium_test
      POSTGRES_DB: voltium_test
    ports:
      - 5432:5432
```

### 1b. CI Test Pipeline
In `test` job, after migration + contract tests:
1. Seed database — `npm run db:seed`
2. Start dev server — `npm run dev &`, PID captured
3. Wait — `npx wait-on tcp:8081` (60s timeout)
4. Integration tests — `npm run test:integration`
5. API route tests — `npm run test:api`
6. Stop dev server — `if: always()` kill

### 1c. Review Skipped Tests ✅
- ~~28 skipped unit tests~~ → 0 skipped. All tests re-enabled and passing.

---

## Phase 2 — Backend Negative & Edge-Case Tests

### 2a. Auth & RBAC Negative Tests ✅

| Test | Assert | File |
|---|---|---|
| Expired JWT | `null` | `tests/unit/auth.test.ts` |
| Invalid JWT signature | `null` | `tests/unit/auth.test.ts` |
| Missing token | `null` | `tests/unit/auth.test.ts` |
| Cross-tenant access (Rider A → Rider B) | `403` | `tests/integration/auth/auth_negative.test.ts` |
| Rider calls admin route | `401` | `tests/integration/auth/auth_negative.test.ts` |
| Admin calls rider route | `401` | `tests/integration/auth/auth_negative.test.ts` |
| Rate-limited `send-otp` | `429` | `tests/integration/auth/rate-limit-negative.test.ts` |
| OTP brute force | `429` | `tests/integration/auth/rate-limit-negative.test.ts` |

### 2b. Input Validation ✅

`tests/unit/validation-negative.test.ts` — 256 tests across 30+ schemas:
- Missing required fields → `validateBody` returns error
- Invalid format (date, phone, email, Aadhaar, PAN, IFSC) → error
- Empty/null/undefined → error
- Extreme values (negative amounts, huge strings, NaN, Infinity) → error

### 2c. State Machine Transitions ✅

`tests/unit/state-machines.test.ts` — all invalid transitions blocked:
| Machine | Invalid Transition | Result |
|---|---|---|
| `RiderLifecycleStatus` | `NEW` → `ACTIVE` (skip KYC) | `false` |
| `KycStatus` | `DRAFT` → `APPROVED` (skip submit) | `false` |
| `DepositStatus` | `PENDING_VERIFICATION` → `REFUNDED` (skip approve) | `throws` |
| `TransactionStatus` | `PENDING` → `REVERSED` (not supported) | `false` |

### 2d. Conflict & Race ✅

`tests/unit/conflict-negative.test.ts` — 46 tests:
- Double-book vehicle+shift → blocked
- KYC submission after approved → blocked
- Wallet withdraw with insufficient funds → blocked
- Transaction double-spend (approve after approve) → blocked
- Rider lifecycle step-skip guards → all blocked
- Deposit concurrent approval → blocked

---

### 2e. Coverage Summary

| Sub-phase | Test File | Test Count | Status |
|---|---|---|---|
| 2a Auth/RBAC | `auth.test.ts` + `auth_negative.test.ts` + `rate-limit-negative.test.ts` | 30+ | ✅ |
| 2b Validation | `validation-negative.test.ts` | 256 | ✅ |
| 2c State Machines | `state-machines.test.ts` | 80+ | ✅ |
| 2d Conflict/Race | `conflict-negative.test.ts` | 46 | ✅ |

---

## Phase 3 — Webhook & Cron Tests ✅

### 3a. Worker Endpoint (`POST /api/internal/worker`) ✅

`tests/unit/worker-cron-negative.test.ts` — Worker auth guard and job queue logic:
- Missing WORKER_SECRET → 401 (dev) / 503 (prod)
- Invalid Bearer token → 401
- Valid token → processes pending jobs
- Exponential backoff: `min(2^attempts × 5s, 1h)` verified for all attempt counts
- Job types constants verified (sms.send, notification.send, etc.)

### 3b. Cron Auth Guard ✅

`tests/unit/cron-auth.test.ts` — 10 tests for `requireCronAuth`:
- Missing CRON_SECRET → 503 (misconfigured)
- Weak secret (< 16 chars) → 503
- Missing/wrong Bearer token → 401
- Correct token → null (auth passed)
- Boundary: 16 chars accepted, 15 chars rejected

### 3c. Cron Job Edge Cases ✅

`tests/unit/worker-cron-negative.test.ts` — Supporting logic tests:
- Notifications cron: result structure `{birthdays, paymentReminders, referralLeaderboard}`
- Reconciliation: idempotency (same date = same report), result shape `{healthy, drifted, totalDrift}`
- Telemetry cleanup: 30-day retention cutoff verified
- All counter values are non-negative integers

### 3d. Coverage Summary

| Sub-phase | Test File | Test Count | Status |
|---|---|---|---|
| 3a Worker Auth | `worker-cron-negative.test.ts` | 4 | ✅ |
| 3b Cron Auth | `cron-auth.test.ts` | 10 | ✅ |
| 3c Job Queue | `worker-cron-negative.test.ts` | 12 | ✅ |
| 3d Reconciliation | `worker-cron-negative.test.ts` | 5 | ✅ |
| 3e Telemetry | `worker-cron-negative.test.ts` | 2 | ✅ |

---

## Phase 4 — Flutter Widget & Unit Tests ✅

### 4a. Widget Tests ✅

| Screen | Test File | Tests | Coverage |
|---|---|---|---|
| Login | `flutter/test/auth/login_screen_enhanced_test.dart` | 27 | Rendering, phone validation (prefix, length, numeric), button opacity states, referral input, accessibility semantics, isSignUp mode |
| Dashboard | `flutter/test/dashboard/dashboard_widgets_test.dart` | 36 | WalletCard (normal/low-balance/compact/zero/edge), PlanCard (null plan, compact), ReferralCard (display, copy button, edge cases) |
| Profile/Settings | `flutter/test/profile/app_settings_enhanced_test.dart` | 35 | Section headers, toggle interactions (dark mode, notifications, biometrics), language dialog (English/Hindi/Cancel), delete account dialog (confirm/cancel) |
| Wallet | `flutter/test/wallet/wallet_screen_enhanced_test.dart` | 18 | Header rendering, RefreshIndicator, body content, filter chips (All/Credit/Debit), action buttons |
| Support | `flutter/test/support/support_center_enhanced_test.dart` | 25 | SupportCenterScreen (FAQ + Contact rows), FeedbackScreen (rating stars, comment input, submit enabled/disabled), TroubleshooterScreen |
| Offline/Error | `flutter/test/offline_error_states_test.dart` | 15 | Null rider data, empty transactions, loading skeleton, theme toggle state, locale switch state |

### 4b. Offline & Error States ✅

| Scenario | Test |
|---|---|
| Null rider → default name shown | ProfileScreen with `_MockAppProvider(rider: null)` |
| Empty transactions → no crash | WalletScreen with empty list |
| Loading skeleton renders | ActiveDashboard with `isLoading: true` |
| Theme toggle persists state | ThemeProvider toggle test |
| Locale toggle switches language | LocaleProvider switch test |

### 4c. Coverage Summary

| Sub-phase | Test File | Test Count | Status |
|---|---|---|---|
| 4a Login | `login_screen_enhanced_test.dart` | 27 | ✅ |
| 4a Dashboard | `dashboard_widgets_test.dart` | 36 | ✅ |
| 4a Settings | `app_settings_enhanced_test.dart` | 35 | ✅ |
| 4a Wallet | `wallet_screen_enhanced_test.dart` | 18 | ✅ |
| 4a Support | `support_center_enhanced_test.dart` | 25 | ✅ |
| 4b Offline/Error | `offline_error_states_test.dart` | 15 | ✅ |
| **Total** | **6 files** | **156** | **✅** |

---

## Phase 5 — Cross-Cutting ✅

### 5a. Migration Tests ✅

`tests/unit/migration.test.ts` — 32 tests validating Prisma migration integrity:
- Migration directory structure exists with `migration_lock.toml` (PostgreSQL)
- Every migration folder has a SQL file
- Folder names match timestamp pattern (14-digit) or `0_init`
- Timestamps are monotonically increasing (no out-of-order migrations)
- Schema has required models: Rider, Wallet, WalletLedger, Vehicle, RentalLease, Transaction, Admin, SupportTicket
- No dangerous SQL patterns (DROP TABLE, DELETE FROM, TRUNCATE) in schema

CI already runs `prisma migrate deploy` + `prisma migrate status` in the `test` job.

### 5b. Secrets Validation ✅

`tests/unit/secrets-validation.test.ts` — 17 tests validating env schema guards:
- Rejects config missing required fields (DATABASE_URL, JWT_SECRET)
- Enforces minimum length for JWT_SECRET (32 chars) and FCM_COMMAND_HMAC_SECRET (32 chars)
- Detects insecure placeholders (voltium-dev-secret, YOUR_SECURE, placeholder, etc.)
- Production guards: CRON_SECRET and WORKER_SECRET required in prod
- Dev OTP/admin bypass blocked in non-development environments
- Validates DATABASE_URL format and applies sensible defaults

### 5c. Load Test (k6) ✅

`tests/load/vehicles-load.k6.ts` — GET /api/vehicles load test:
- 100 concurrent VUs with ramping-vus executor
- Stages: ramp 0→50→100, hold 30s, ramp down
- Thresholds: p95 < 500ms, error rate < 1%
- Custom metrics: `vehicle_list_duration` trend

`tests/load/rental-book-load.k6.ts` — POST /api/rental/book load test:
- 50 concurrent VUs with ramping-vus executor
- Stages: ramp 0→25→50, hold 30s, ramp down
- Thresholds: p95 < 2s, error rate < 10% (409 conflicts are expected)
- Tracks expected conflicts (409) separately from real errors
- Random date/time generation within next 7 days

### 5d. Contract Tests ✅

Existing: `src/contracts/__tests__/contract-validator.test.ts` (20 tests):
- Contract files exist for all 11 modules (auth, rider, kyc, wallet, rental, support, deposit, files, notification, vehicle, hub)
- OpenAPI spec is valid JSON with correct version (3.0.3) and title
- All required path groups documented (auth, rider, wallet, rental, vehicles, admin, etc.)
- Enum consistency: TicketStatus, KycStatus, DepositAction, TransactionAction match state machines
- API route consistency: all non-internal routes documented in openapi.json
- npm scripts (`generate:openapi`, `test:contracts`) verified

### 5e. Coverage Summary

| Sub-phase | Test File | Test Count | Status |
|---|---|---|---|
| 5a Migration | `tests/unit/migration.test.ts` | 32 | ✅ |
| 5b Secrets | `tests/unit/secrets-validation.test.ts` | 17 | ✅ |
| 5c Load (k6) | `tests/load/vehicles-load.k6.ts` + `rental-book-load.k6.ts` | 2 scripts | ✅ |
| 5d Contracts | `src/contracts/__tests__/contract-validator.test.ts` | 20 | ✅ |

---

## Priority

```
Phase 1  ████████████████████████████████  ✅ DONE (CI integration tests)
Phase 2  ████████████████████████████      ✅ DONE (security & edge cases)
Phase 3  ██████████████████                ✅ DONE (payment/reliability)
Phase 4  ████████████████                  ✅ DONE (Flutter widget & unit tests)
Phase 5  █████████                         ✅ DONE (hardening: migration, secrets, load, contracts)
```

**Status as of 2026-06-29**: All 5 phases complete. ~2,099 automated test cases. See [`docs/COVERAGE_PLAN.md`](../../docs/COVERAGE_PLAN.md) for the next phase — meaningful 100% coverage gap analysis and 5-milestone plan to fill remaining gaps.

---

## Phase 6 — Meaningful 100% Coverage (Forward Plan)

The 5 phases above addressed the highest-priority testing gaps at the time. A comprehensive gap analysis (see `docs/COVERAGE_PLAN.md` for full details) identified remaining low-coverage areas:

| Layer | Coverage | Gap |
|---|---|---|
| Web `src/server/modules/wallet/`, `deposits/`, `transactions/` services | <30% | Money-path ledger logic untested |
| Web `src/server/workers/jobs/` | 17% | 10 of 12 jobs have no direct unit test |
| Web `src/app/api/**/route.ts` | ~43% | ~70 of 123 route handlers untested, mostly mutations |
| Web `src/server/shared/` | 0% | Cross-cutting auth/db/errors modules untested |
| Web `src/components/admin/` | ~5% | Admin UI covered only by Playwright (fragile) |
| Flutter `lib/services/` | 25% | 15 of 20 services untested (biometric, location, notifications, etc.) |
| Flutter `lib/providers/` | 18% | 9 of 11 providers untested (incl. `app_provider` global state) |
| Flutter `lib/features/*/data/` | 0% | All 6 repository implementations untested |
| Flutter `lib/models/` | 7% | 13 of 14 models untested |
| Flutter screens (16) | varies | KYC intent, wallet history, support checklist, notification prefs, etc. |

### Plan Reference

See [`docs/COVERAGE_PLAN.md`](../../docs/COVERAGE_PLAN.md) for the full 5-milestone plan to close these gaps. The plan uses:

- **Real Postgres** (testcontainers per file, CI Postgres service) for money-path tests
- **Real timers with `Clock` injection** via dispatcher for worker job tests
- **Golden tests** (per-widget, per-state, single device pixel ratio) for Flutter screens
- **Coverage gates** in CI: 85% lines / 75% branches (web), 80% lines / 70% branches (Flutter)

**Estimated effort**: ~17 days, ~1,033 new tests, ~145 new test files.

**Excluded from coverage**: generated code (`*.g.dart`, `*.freezed.dart`, `web/src/contracts/openapi.json`, `flutter/lib/core/network/generated/*`), trivial getters, static config (`app_constants.dart`, `app_info.dart`, brand colors, design tokens).

### Cleanup Tasks (with Phase 6)

- Delete `web/tests/realistic/_bootstrap/` (empty)
- Delete 9 placeholder `web/e2e/*.spec.ts` files (consolidated into `rider-flutter-tests.spec.ts`)
- Replace `flutter/test/widget_test.dart` (placeholder) with meaningful first-launch smoke
- Consolidate redundant `flutter/integration_test/` root files into `e2e_individual/`
- Annotate or delete `web/tests/unit/worker-jobs.test.ts` (asserts on local mocks, superseded by Phase 2 dispatcher tests)
