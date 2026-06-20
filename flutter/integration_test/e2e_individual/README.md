# Voltium Individual E2E Tests

This directory contains **33 standalone E2E test files**, each runnable independently with `flutter drive`. Each test launches a fresh app instance, ensuring complete isolation.

## Quick Start

### Prerequisites
1. Emulator running (default: `emulator-5554`)
2. Backend running at `http://localhost:8081`
3. ADB reverse configured:
   ```bash
   adb reverse tcp:8081 tcp:8081
   ```

### Run a Single Test

```bash
flutter drive \
  --driver=test_driver/integration_test.dart \
  --target=integration_test/e2e_individual/01_splash_screen_test.dart \
  -d emulator-5554 \
  --dart-define=API_URL=http://localhost:8081
```

### Run All Tests

```bash
cd integration_test/e2e_individual
./run_all_tests.sh [device_id]
```

Or run a specific subset:

```bash
# Auth tests only
for f in 01 02 03 04 05 06 17 18 19; do
  flutter drive --driver=test_driver/integration_test.dart \
    --target=integration_test/e2e_individual/${f}_*.dart \
    -d emulator-5554 --dart-define=API_URL=http://localhost:8081
done
```

## Test Inventory

### Authentication (9 tests)
| # | File | Description |
|---|------|-------------|
| 01 | `01_splash_screen_test.dart` | Splash branding and auto-navigation |
| 02 | `02_legal_screen_test.dart` | Legal/terms acceptance |
| 03 | `03_permissions_screen_test.dart` | Permissions screen flow |
| 04 | `04_login_screen_test.dart` | Phone entry → OTP screen |
| 05 | `05_otp_verification_test.dart` | Enter OTP → dashboard/onboarding |
| 06 | `06_full_auth_login_test.dart` | Complete auth flow |
| 17 | `17_otp_resend_test.dart` | Resend OTP button |
| 18 | `18_otp_back_button_test.dart` | Back button from OTP |
| 19 | `19_logout_test.dart` | Logout → login screen |

### Dashboard (3 tests)
| # | File | Description |
|---|------|-------------|
| 07 | `07_dashboard_elements_test.dart` | All key elements present |
| 08 | `08_dashboard_navigation_test.dart` | Bottom tab switching |
| 09 | `09_notifications_test.dart` | Notification bell → mark all read |
| 10 | `10_referral_widget_test.dart` | Referral code display + copy |
| 27 | `27_missing_vehicle_state_test.dart` | Handles no vehicle assignment |
| 28 | `28_offline_indicator_test.dart` | Offline state handling |
| 29 | `29_empty_referral_test.dart` | Empty/null referral code |

### Wallet (3 tests)
| # | File | Description |
|---|------|-------------|
| 11 | `11_wallet_balance_test.dart` | Balance display + action buttons |
| 12 | `12_wallet_topup_test.dart` | Top-up dialog open/close |
| 13 | `13_wallet_filters_test.dart` | Transaction filter chips |

### Profile (3 tests)
| # | File | Description |
|---|------|-------------|
| 14 | `14_profile_display_test.dart` | Rider info and status tiles |
| 15 | `15_profile_edit_test.dart` | Edit form fields |
| 16 | `16_profile_kyc_status_test.dart` | KYC status tile |

### Support (4 tests)
| # | File | Description |
|---|------|-------------|
| 20 | `20_support_screen_test.dart` | FAQ and ticket button |
| 21 | `21_support_faq_test.dart` | FAQ accordion expand/collapse |
| 22 | `22_support_chat_test.dart` | Chat input and send |
| 23 | `23_support_ticket_test.dart` | Raise ticket dialog |

### Settings (3 tests)
| # | File | Description |
|---|------|-------------|
| 24 | `24_settings_screen_test.dart` | All toggles and options |
| 25 | `25_settings_theme_toggle_test.dart` | Light/dark theme switch |
| 26 | `26_settings_biometric_toggle_test.dart` | Biometric auth toggle |

### Full Journeys & Edge Cases (7 tests)
| # | File | Description |
|---|------|-------------|
| 30 | `30_full_journey_test.dart` | Splash → dashboard complete flow |
| 31 | `31_error_recovery_test.dart` | Invalid phone → error snackbar |
| 32 | `32_rental_end_test.dart` | End rental button flow |
| 33 | `33_onboarding_referral_logout_test.dart` | Onboarding → referral → logout |

## Architecture

### Isolation Strategy
Each test file:
1. Calls `IntegrationTestWidgetsFlutterBinding.ensureInitialized()`
2. Calls `launchApp(tester)` which runs `app.main()` fresh
3. Completes screens sequentially using `complete*Screen()` helpers
4. Makes assertions independently

### Shared Helpers
Located in `../helpers/test_helpers.dart`:
- `safeAppMain()` — Wraps `app.main()` preserving test framework error handling
- `launchApp(tester)` — Launches app and waits past splash
- `completeLegalScreen(tester)` — Idempotent legal screen handler
- `completePermissionsScreen(tester)` — Idempotent permissions handler
- `completeAuthChoiceScreen(tester)` — Idempotent auth choice handler
- `completeAuthFlow(tester)` — Phone + OTP verification
- `completeOnboardingFlow(tester)` — Intent → user form → guarantor
- `fullLoginFlow(tester)` — Complete journey helper returning `bool`
- `navigateToTab(tester, key)` — Bottom nav switching
- `expectOnDashboard(tester)` — Dashboard assertions
- `waitFor(tester, finder)` — Explicit wait with timeout
- `scrollToAndTap(tester, finder)` — Scroll then tap

## Debugging Failed Tests

### Screenshot on Failure
```bash
flutter drive \
  --driver=test_driver/integration_test.dart \
  --target=integration_test/e2e_individual/04_login_screen_test.dart \
  -d emulator-5554 \
  --screenshot=/tmp/test_screenshots
```

### Verbose Output
```bash
flutter drive \
  --driver=test_driver/integration_test.dart \
  --target=integration_test/e2e_individual/04_login_screen_test.dart \
  -d emulator-5554 \
  --verbose
```

### Check Device Connection
```bash
flutter devices
adb devices
```

## CI/CD Integration

For GitHub Actions, run tests in parallel jobs:

```yaml
jobs:
  test-auth:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
      - run: flutter pub get
      - run: |
          flutter drive \
            --driver=test_driver/integration_test.dart \
            --target=integration_test/e2e_individual/06_full_auth_login_test.dart \
            -d emulator
```
