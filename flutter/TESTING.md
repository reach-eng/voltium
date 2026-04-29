# Flutter Integration Testing

This directory contains the end-to-end (E2E) integration test suite for the VoltFleet Android app.

## Test Structure

```
flutter/
├── integration_test/
│   ├── app_test.dart              # Full 13-step user journey
│   ├── onboarding_flow_test.dart  # Onboarding-only test
│   └── diagnostic_test.dart       # Quick smoke test
├── test_driver/
│   └── integration_test.dart      # Test driver entry point
└── lib/screens/                   # All screens now have test keys
```

## Test Keys

All interactive widgets across 24 screen files have been keyed for reliable testing:

- **Auth**: `phoneInput`, `sendOtpButton`, `otpInput`, `verifyOtpButton`
- **Onboarding**: `acceptCheckbox`, `continueLegalButton`, `fullNameField`, `completeOnboardingButton`
- **Plan & Pickup**: `planCard`, `confirmPlanButton`, `hubCard`, `inspectionItem1`–`inspectionItem7`
- **Wallet**: `topUpButton`, `amount500`–`amount5000`, `submitProofButton`
- **Profile**: `editProfileLink`, `editFullNameField`, `submitProfileButton`, `logoutButton`
- **Support**: `issueTypeDropdown`, `raiseTicketButton`
- **Dashboard**: `notificationBell`, `pointsBadge`, `assignedVehicleCard`
- **Navigation**: `dashboardTab`, `walletTab`, `supportTab`, `profileTab`

## Running Tests Locally

### Prerequisites

1. Android emulator running (API 33 recommended to avoid WebSocket bugs) or physical device
2. Dev server running on `localhost:8081`
3. `adb reverse tcp:8081 tcp:8081` (for emulators)

### Commands

```bash
# Start the backend dev server
cd /path/to/voltfleet
npm run dev

# In another terminal, run all E2E tests
cd flutter
flutter test integration_test/app_test.dart \
  --dart-define=API_URL=http://localhost:8081 \
  -d <device-id>

# Run just the diagnostic smoke test
flutter test integration_test/diagnostic_test.dart \
  --dart-define=API_URL=http://localhost:8081 \
  -d <device-id>

# Run just the onboarding flow
flutter test integration_test/onboarding_flow_test.dart \
  --dart-define=API_URL=http://localhost:8081 \
  -d <device-id>
```

## CI/CD

### Automatic E2E Tests

E2E tests run automatically on every PR/push that touches `flutter/**` files via the `Flutter CI/CD` workflow (`.github/workflows/flutter-ci-cd.yml`).

### Manual E2E Tests

You can trigger E2E tests manually via GitHub Actions:

1. Go to **Actions** → **Flutter E2E Tests (Manual)**
2. Click **Run workflow**
3. Select:
   - **Android API level**: 29–34 (default: 33)
   - **Test file**: `app_test.dart`, `onboarding_flow_test.dart`, or `diagnostic_test.dart`
4. Click **Run workflow**

### CI Configuration

The CI pipeline:
1. Checks out code
2. Installs Node.js backend dependencies
3. Sets up the database with Prisma
4. Starts the Next.js dev server
5. Sets up Flutter
6. Launches an Android emulator (Pixel 6, API 33)
7. Runs the selected integration tests
8. Uploads screenshots and logs on failure

## Troubleshooting

### WebSocket Connection Error

If you see:
```
WebSocketChannelException: HttpException: Connection closed before full header was received
```

This is a known Flutter bug with Android API 36 emulators. **Solutions:**
1. Use an emulator with API 33 or 34
2. Use a physical Android device
3. Run tests in CI (GitHub Actions)

### App Not Finding Backend

Ensure `adb reverse` is set up:
```bash
adb reverse tcp:8081 tcp:8081
```

Or use your machine's local IP:
```bash
flutter test ... --dart-define=API_URL=http://192.168.x.x:8081
```

### Tests Timing Out

The tests use `pumpAndSettle()` with generous timeouts. If tests timeout:
1. Check the dev server is responding: `curl http://localhost:8081`
2. Check the app can reach the backend via the API URL
3. Increase timeout in the test with `await tester.pump(const Duration(seconds: 5))`

## Test Coverage

| Flow | Tested |
|------|--------|
| Authentication (OTP login) | ✅ |
| Legal consent acceptance | ✅ |
| Permissions screen | ✅ |
| User onboarding form | ✅ |
| Guarantor onboarding form | ✅ |
| Plan selection | ✅ |
| Vehicle pickup (hub → vehicle → inspection → photo) | ✅ |
| Dashboard navigation | ✅ |
| Wallet & top-up | ✅ |
| Rewards screen | ✅ |
| Profile editing | ✅ |
| Support ticket creation | ✅ |
| Emergency SOS screen | ✅ |
| Notifications | ✅ |
| Logout | ✅ |
| Full chained journey | ✅ |
