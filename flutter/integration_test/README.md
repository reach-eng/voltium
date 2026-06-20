# Voltium E2E Test Suite

## Overview

Comprehensive end-to-end test suite for the Voltium Rider Flutter app. Tests cover the complete user journey from splash screen to logout, including all major features and edge cases.

## Test Structure

```
integration_test/
├── helpers/
│   └── test_helpers.dart          # Shared utilities and helpers
└── e2e/
    ├── auth_flow_test.dart        # Login, OTP, auth choice, logout (10 tests)
    ├── onboarding_flow_test.dart  # Intent, user form, guarantor, pickup (9 tests)
    ├── dashboard_test.dart        # Dashboard elements, navigation, referral (10 tests)
    ├── wallet_test.dart           # Balance, top-up, history, filters (11 tests)
    ├── profile_test.dart          # Profile, edit, documents, SOS, rewards (14 tests)
    ├── support_test.dart          # Tickets, FAQ, notifications (8 tests)
    ├── settings_test.dart         # Dark mode, language, 2FA, delete account (12 tests)
    ├── error_edge_cases_test.dart # Validation, empty states, stress tests (17 tests)
    └── full_journey_test.dart     # Complete user journey (3 tests)
```

**Total: 94 E2E tests**

## Prerequisites

1. Android emulator or physical device connected
2. Backend server running on `http://10.0.2.2:8081` (or your API URL)
3. Flutter SDK installed

## Running Tests

### Run all E2E tests

```bash
flutter test integration_test/e2e/ -d <device-id>
```

### Run a specific test file

```bash
# Auth flow tests
flutter test integration_test/e2e/auth_flow_test.dart -d <device-id>

# Dashboard tests
flutter test integration_test/e2e/dashboard_test.dart -d <device-id>

# Full journey test
flutter test integration_test/e2e/full_journey_test.dart -d <device-id>
```

### Run with custom API URL

```bash
flutter test integration_test/e2e/auth_flow_test.dart \
  --dart-define=API_URL=http://10.0.2.2:8081 \
  -d <device-id>
```

### Run a single test

```bash
flutter test integration_test/e2e/auth_flow_test.dart \
  --name "Login screen – enter phone and send OTP" \
  -d <device-id>
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

## Test Helpers

The `test_helpers.dart` file provides reusable utilities:

| Helper | Description |
|--------|-------------|
| `launchApp()` | Launches app and waits for splash to complete |
| `waitFor()` | Waits for a widget to appear with timeout |
| `waitUntilGone()` | Waits for a widget to disappear |
| `completeLegalScreen()` | Completes terms acceptance if shown |
| `completePermissionsScreen()` | Completes permissions screen if shown |
| `completeAuthFlow()` | Completes phone + OTP verification |
| `completeOnboardingFlow()` | Completes intent + user form + guarantor |
| `fullLoginFlow()` | Complete setup: launch → auth → onboarding |
| `navigateToTab()` | Navigates to a bottom nav tab |
| `expectOnDashboard()` | Asserts dashboard is visible |
| `expectOnLogin()` | Asserts login screen is visible |

## Test Categories

### Auth Flow (10 tests)
- Splash screen display and auto-navigation
- Legal/terms acceptance
- Permissions screen
- Phone entry and OTP sending
- OTP verification
- Auth choice screen (create account / login)
- Full auth → onboarding → dashboard chain
- Logout flow

### Onboarding (9 tests)
- Intent of use selection
- User onboarding form
- Guarantor form
- Plan selection
- Pickup hub selection
- Vehicle verification
- Inspection checklist
- Pickup verification
- Full onboarding chain

### Dashboard (10 tests)
- Core element verification
- Notification bell navigation
- Points badge → rewards
- Team leader details
- Vehicle card details
- Referral widget (copy code)
- Pull to refresh
- Bottom navigation switching
- Manage subscription
- Action required banner

### Wallet (11 tests)
- Balance display
- Top-up dialog
- Top-up amount entry and submit
- Cancel top-up
- Transaction filters
- History navigation
- Payment method selection
- UPI reference field
- Payment proof upload
- Security deposit card
- Payment streak bar

### Profile (14 tests)
- Rider info display
- KYC status
- Guarantor status
- Edit profile navigation
- Edit and save profile
- My documents navigation
- Rewards navigation
- Referral navigation
- App settings navigation
- Legal screen navigation
- Emergency SOS
- Logout
- Guarantor information
- All quick links navigable

### Support (8 tests)
- Support center display
- Raise ticket
- FAQ navigation
- Call us action
- Email us action
- Empty description validation
- Mark all notifications read
- Notification cards

### Settings (12 tests)
- Settings screen open
- Dark mode toggle
- Notifications toggle
- Language selection (English/Hindi)
- Two-factor auth toggle
- Terms of service
- Privacy policy
- Rate us
- Change phone number
- Change password
- Delete account dialog (cancel)
- Navigate back

### Error & Edge Cases (17 tests)
- Empty phone number
- Short phone number
- Invalid OTP
- Zero top-up amount
- Negative amount
- Very large amount
- Empty profile fields
- Invalid email format
- Empty ticket description
- No assigned vehicle
- Empty transaction history
- Empty notifications
- Missing rider data
- Rapid navigation stress test
- Deep screen back navigation
- Multiple dialog dismissals
- Special characters (XSS prevention)

### Full Journey (3 tests)
- Complete user journey (splash → logout)
- Returning user flow (cached login)
- Multi-tab navigation stress test

## CI/CD Integration

Add to your GitHub Actions workflow:

```yaml
- name: Run E2E Tests
  run: |
    flutter test integration_test/e2e/ \
      --dart-define=API_URL=http://localhost:8081 \
      -d emulator-5554
```

## Notes

- Tests are designed to be **idempotent** – each test can run independently
- Tests use **conditional checks** – if a screen isn't shown (e.g., already logged in), the test skips gracefully
- All tests use **Keys** for reliable widget targeting
- The `fullLoginFlow()` helper handles the complete setup, making individual feature tests concise
- Tests handle **both new and returning user** flows automatically
