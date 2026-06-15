# VoltFleet Flutter E2E Testing Guide

## Overview

The Flutter e2e test suite is fully implemented and operational. This guide documents how to run, maintain, and extend the existing tests.

## Test Suite Structure

```
flutter/integration_test/
├── helpers/
│   └── test_helpers.dart          # Reusable utilities and helpers
├── e2e/                          # Main test suites (94 tests total)
│   ├── auth_flow_test.dart        # Login, OTP, auth choice, logout (10 tests)
│   ├── onboarding_flow_test.dart  # Intent, user, guarantor, pickup (9 tests)
│   ├── dashboard_test.dart        # Dashboard, navigation, referral (10 tests)
│   ├── wallet_test.dart           # Balance, top-up, history, filters (11 tests)
│   ├── profile_test.dart          # Profile, edit, SOS, rewards (14 tests)
│   ├── support_test.dart          # Tickets, FAQ, notifications (8 tests)
│   ├── settings_test.dart         # Dark mode, language, 2FA (12 tests)
│   ├── error_edge_cases_test.dart # Validation, empty states (17 tests)
│   └── full_journey_test.dart     # Complete user journey (3 tests)
├── e2e_individual/               # Granular, targeted tests (37 files)
├── app_test.dart                 # Legacy comprehensive test
├── comprehensive_e2e_test.dart   # Legacy test with enhanced logging
└── README.md                     # This guide
```

## Running Tests

### Prerequisites

1. Android emulator running or physical device connected
2. Backend server running on `http://10.0.2.2:8081` (or set API_URL)
3. Flutter SDK installed (already at 3.41.4)

### Basic Commands

```bash
cd /Users/amreenfarooq/Downloads/voltfleet/flutter

# Run all e2e tests
flutter test integration_test/e2e/ -d <device-id>

# Run specific test file
flutter test integration_test/e2e/auth_flow_test.dart -d <device-id>

# Run with custom API URL
flutter test integration_test/e2e/auth_flow_test.dart \
  --dart-define=API_URL=http://10.0.2.2:8081 \
  -d <device-id>

# Run a single test by name
flutter test integration_test/e2e/auth_flow_test.dart \
  --name "Login screen – enter phone and send OTP" \
  -d <device-id>

# Run all tests in integration_test/
flutter test integration_test/ -d <device-id>
```

### Getting Device ID

```bash
# List connected devices
flutter devices

# Example output:
# Android SDK built for x86_64 • emulator-5554 • android-x64 • Android 11 (API 30) (emulator)
```

## Test Helpers

The `test_helpers.dart` file provides reusable utilities:

| Helper                        | Description                                |
| ----------------------------- | ------------------------------------------ |
| `safeAppMain()`               | Launches app with error handler restore    |
| `resetAppState()`             | Clears SharedPreferences and cache         |
| `launchApp()`                 | Launches app and waits past splash         |
| `waitFor()`                   | Waits for widget with timeout              |
| `waitUntilGone()`             | Waits for widget to disappear              |
| `completeLegalScreen()`       | Completes terms acceptance                 |
| `completePermissionsScreen()` | Completes permissions screen               |
| `completeAuthChoiceScreen()`  | Clicks login with phone                    |
| `completeAuthFlow()`          | Full phone + OTP flow                      |
| `completeOnboardingFlow()`    | Intent + user + guarantor                  |
| `fullLoginFlow()`             | Complete setup: launch\`→auth\`→onboarding |
| `navigateToTab()`             | Navigates to bottom nav tab                |
| `expectOnDashboard()`         | Asserts dashboard visible                  |
| `expectOnLogin()`             | Asserts login screen visible               |

### Test Credentials

```dart
class TestCredentials {
  static const String phone = '9876543210';
  static const String otp = '111111';
  static const String fullName = 'Test Rider';
  static const String email = 'test@example.com';
  static const String fatherName = 'Test Father';
  static const String motherName = 'Test Mother';
  static const String guarantorName = 'Test Guarantor';
  static const String guarantorPhone = '9998887776';
}
```

## Example Test Usage

### Running a Single Flow

```bash
cd /Users/amreenfarooq/Downloads/voltfleet/flutter
flutter test integration_test/e2e/auth_flow_test.dart \
  --dart-define=API_URL=http://10.0.2.2:8081 \
  -d emulator-5554
```

### Running Full Journey

```bash
flutter test integration_test/e2e/full_journey_test.dart \
  --dart-define=API_URL=http://10.0.2.2:8081 \
  -d emulator-5554
```

### Running All Tests

```bash
flutter test integration_test/e2e/ \
  --dart-define=API_URL=http://10.0.2.2:8081 \
  -d emulator-5554
```

## Writing New Tests

### Template for New Test Files

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:voltfleet_rider/main.dart' as app;
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Feature Name E2E', () {
    setUp(() async {
      await resetAppState();
    });

    testWidgets('Test description', (tester) async {
      // Launch app
      await safeAppMain();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 4));

      // Complete necessary setup
      await completeLegalScreen(tester);
      await completePermissionsScreen(tester);
      await completeAuthFlow(tester);
      await completeOnboardingFlow(tester);

      // Navigate to feature
      await navigateToTab(tester, 'featureTab');

      // Assertions
      expect(find.byKey(const Key('featureWidget')), findsOneWidget);

      // Actions
      await tester.tap(find.byKey(const Key('actionButton')));
      await tester.pumpAndSettle();

      // Verify result
      expect(find.text('Success'), findsOneWidget);
    });
  });
}
```

### Best Practices

1. **Use Key-based Widget Targeting**

   ```dart
   // In widget code
   TextButton(
     key: const Key('loginButton'),
     onPressed: () {},
     child: const Text('Login'),
   )

   // In test
   await tester.tap(find.byKey(const Key('loginButton')));
   ```

2. **Handle Async Operations**

   ```dart
   // Use waitFor for widgets that appear after delay
   await waitFor(tester, find.byKey(const Key('asyncWidget')));

   // Multiple pumps for animations
   for (int i = 0; i < 20; i++) {
     await tester.pump(const Duration(milliseconds: 100));
   }
   ```

3. **Conditional Checks for Optional Screens**

   ```dart
   // Check if screen is shown before interacting
   final screen = find.byKey(const Key('optionalScreen'));
   if (screen.evaluate().isNotEmpty) {
     await tester.tap(screen);
     await tester.pumpAndSettle();
   }
   ```

4. **Reuse Helper Functions**
   ```dart
   // Instead of repeating setup, use helpers
   await fullLoginFlow(tester);
   ```

## Test Categories

### Auth Flow (10 tests)

- Splash screen display
- Legal/terms acceptance
- Permissions screen
- Phone entry and OTP
- Auth choice screen
- Full auth chain
- Logout flow

### Onboarding (9 tests)

- Intent selection
- User onboarding form
- Guarantor form
- Plan selection
- Pickup hub
- Vehicle verification
- Inspection checklist
- Full onboarding chain

### Dashboard (10 tests)

- Core elements
- Navigation
- Pull to refresh
- Bottom nav switching
- Action banners

### Wallet (11 tests)

- Balance display
- Top-up dialog
- Transaction history
- Filters
- Payment methods

### Profile (14 tests)

- Rider info
- KYC status
- Edit profile
- Documents
- Emergency SOS
- Rewards

### Support (8 tests)

- Support center
- Raise ticket
- FAQ
- Call/email support
- Notifications

### Settings (12 tests)

- Dark mode
- Language
- Notifications
- 2FA
- Account deletion

### Error & Edge Cases (17 tests)

- Validation errors
- Empty states
- Invalid input
- Stress tests

### Full Journey (3 tests)

- Complete user journey
- Returning user flow
- Multi-tab navigation

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Flutter
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.41.4'

      - name: Install dependencies
        run: flutter pub get
        working-directory: flutter

      - name: Run E2E Tests
        run: |
          flutter test integration_test/e2e/ \
            --dart-define=API_URL=http://localhost:8081 \
            -d emulator-5554
```

### Local Testing

```bash
# Start emulator
emulator -avd Pixel_5_API_30 &

# Start backend
cd /Users/amreenfarooq/Downloads/voltfleet
npm start &

# Run tests
cd flutter
flutter test integration_test/e2e/ \
  --dart-define=API_URL=http://10.0.2.2:8081 \
  -d emulator-5554
```

## Debugging Tests

### Common Issues

1. **Widget Not Found**
   - Check if widget key is correct
   - Add waitFor for async widgets
   - Verify screen was navigated to

2. **Timeout Errors**
   - Increase timeout in waitFor()
   - Add more pump iterations
   - Check for infinite animations

3. **Authentication Failures**
   - Verify backend is running
   - Check API_URL is correct
   - Ensure test credentials are valid

### Debug Commands

```bash
# Run with verbose logging
flutter test -v integration_test/e2e/auth_flow_test.dart -d emulator-5554

# Start paused for debugging
flutter test integration_test/e2e/auth_flow_test.dart \
  --start-paused \
  -d emulator-5554

# Run single test
flutter test integration_test/e2e/auth_flow_test.dart \
  --name "Login screen" \
  -d emulator-5554
```

## Maintenance

### Adding New Features

1. Create widget with unique Key
2. Write smoke test in e2e_individual/
3. Add integration test to appropriate e2e .dart file
4. Update README.md with test coverage

### Updating Existing Tests

1. Modify test helpers in test_helpers.dart if needed
2. Update test files to match new UI/flow
3. Ensure conditional checks handle both old and new flows

### Key Management

Keep keys organized and consistent:

```dart
// Good
const Key('loginButton')
const Key('phoneInput')
const Key('dashboardTab')

// Bad
const Key('button1')  // Not descriptive
const Key('login')    // Too generic
```

## Performance Tips

1. **Use smoke tests for quick feedback**

   ```bash
   flutter test integration_test/e2e_individual/06_full_auth_login_test.dart
   ```

2. **Run parallel test groups**

   ```bash
   # Run auth tests
   flutter test integration_test/e2e/auth_flow_test.dart &

   # Run wallet tests
   flutter test integration_test/e2e/wallet_test.dart &
   ```

3. **Skip animations in CI**
   ```yaml
   flutter test \
   --dart-define=DISABLE_ANIMATIONS=true \
   integration_test/e2e/
   ```

## Summary

The e2e test suite is comprehensive and ready to use. Run tests frequently to catch regressions, add new tests for features, and maintain the test helpers to keep the suite robust.

**Quick Start:**

```bash
cd /Users/amreenfarooq/Downloads/voltfleet/flutter
flutter test integration_test/e2e/auth_flow_test.dart \
  --dart-define=API_URL=http://10.0.2.2:8081 \
  -d <your-device-id>
```
