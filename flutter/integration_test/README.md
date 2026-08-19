# Voltium E2E Test Suite

## Overview

Comprehensive end-to-end test suite for the Voltium Rider Flutter app. Tests cover the complete user journey from splash screen to logout, including all major features and edge cases.

**Current count: 49 tests** (per `e2e_individual/` directory — 50 files, 49 unique-numbered, plus 1 test_helpers.dart).

## Test Structure

```
integration_test/
├── helpers/
│   └── test_helpers.dart          # (legacy — see e2e_individual/test_helpers.dart)
├── pages/                         # Page Object Model — composable widgets
│   ├── app_page.dart
│   ├── app_robots.dart
│   ├── dashboard_page.dart
│   ├── pickup_page.dart           # PICKUP P0-1 (TEST-STRATEGY-AUDIT T-P0-1)
│   ├── login_page.dart
│   ├── ...
├── e2e_individual/                # ✅ CANONICAL — 49 numbered tests
│   ├── run_phased_tests.sh        # runs all 49 tests in 17 phases
│   ├── 00_diagnostic_test.dart
│   ├── 01_splash_screen_test.dart
│   ├── 02_legal_screen_test.dart
│   ├── ...
│   ├── 48_emergency_sos_test.dart
│   └── test_helpers.dart          # Shared helpers (used by all 49 tests)
└── e2e_DEPRECATED_DO_NOT_USE/     # 🚫 Retired 2026-08-08 — see inside
    └── README.md
```

The previous test layout had 33 numbered tests + 9 full-journey tests in `e2e/`. After
PR-8 (pickup integration test) and PR-9 (emergency SOS test) added 2 more numbered
tests, the directory had collisions on numbers 34/35/36/37/38/39. The 2026-08-08
TEST-STRATEGY-AUDIT (T-P0-3) re-numbered the collisions to 43–48. The 9 redundant
`e2e/` files were then moved to `D:\voltium\.deprecated\e2e-old-snapshot-2026-08-08\`
and the empty `e2e/` directory was renamed to `e2e_DEPRECATED_DO_NOT_USE/`.

## Prerequisites

1. Android emulator or physical device connected
2. Backend server running on `http://10.0.2.2:8081` (or your API URL)
3. Flutter SDK installed

## Running Tests

### Run all 49 E2E tests (canonical)

```bash
./integration_test/e2e_individual/run_phased_tests.sh emulator-5554
```

This is what CI runs (via `flutter-e2e-manual.yml`). The script shards the tests
across 17 phases; pass `--shard-index=N --shard-count=M` to split across parallel
emulators.

### Run a specific test file

```bash
flutter drive \
  --driver=test_driver/integration_test.dart \
  --target=integration_test/e2e_individual/04_login_screen_test.dart \
  -d emulator-5554 \
  --dart-define=API_URL=http://10.0.2.2:8081 \
  --dart-define=TEST_MODE=true
```

## Test Credentials

All tests use the following default credentials (dev backend accepts any 10-digit phone):

| Field | Value |
|-------|-------|
| Phone | `9876543210` |
| OTP | `111111` |
| Full Name | `Test Rider` |
| Email | `test@example.com` |
| Guarantor | `Test Guarantor` |
| Guarantor Phone | `9998887776` |

## Test Helpers (in `e2e_individual/test_helpers.dart`)

| Helper | Description |
|--------|-------------|
| `launchApp(tester)` | Launches app, clears state, waits past splash |
| `handlePreamble(tester)` | Handles auth choice, legal, permissions screens |
| `completeAuthFlow(tester)` | Phone entry → OTP verification (uses scrollUntilVisible for buttons) |
| `fullLoginFlow(tester)` | Complete journey: splash → auth → onboarding → dashboard |
| `navigateToTab(tester, key)` | Bottom nav switching |
| `expectOnDashboard(tester)` | Dashboard assertion |
| `goBack(tester)` | Handles custom back buttons |
| `setupReturningUser()` | Pre-seeds rider cache for returning user flow |

## CI/CD Integration

The canonical E2E pipeline is `flutter-e2e-manual.yml` (manual trigger) and
`e2e-windows.yml` (auto on PR via Windows runner). Both invoke the
`e2e_individual/` tests.

## Notes

- Tests are designed to be **idempotent** — each test can run independently
- Tests use **conditional checks** — if a screen isn't shown (e.g., already logged in), the test skips gracefully
- All tests use **Keys** for reliable widget targeting
- The `fullLoginFlow()` helper handles the complete setup, making individual feature tests concise
- Tests handle **both new and returning user** flows automatically
