# Testing Voltium on Android

This guide explains how to run unit, widget, and E2E tests for the Voltium Rider App.

## 1. Unit & Widget Tests

Unit and widget tests run locally on your machine without requiring an emulator.

```bash
# Run all unit and widget tests
flutter test

# Run a specific test
flutter test test/transaction_model_test.dart
```

## 2. End-to-End (E2E) Tests

E2E tests run on a connected Android device or emulator. They simulate a real user journey from login to logout.

### Prerequisites

1.  **Android Emulator**: Ensure you have an Android emulator running (e.g., Pixel 6).
2.  **Backend Server**: The tests expect the Voltium backend to be running at `http://10.0.2.2:8081` (standard emulator alias for localhost).

### Running E2E Tests

Use the provided helper script:

```bash
# Run on the default connected device
./run_e2e.sh

# Run on a specific device ID
./run_e2e.sh -d Pixel_6

# Run with a custom API URL
./run_e2e.sh -u http://your-api-url:8081
```

### Coverage

The `comprehensive_e2e_test.dart` covers:
- **Authentication**: Login and OTP verification.
- **Onboarding**: Intent selection, personal details, and guarantor info.
- **Dashboard**: Verification of KPI cards and navigation.
- **Wallet**: Balance check and top-up flow navigation.
- **Profile**: Data verification.
- **Lifecycle**: Complete logout and session clearing.

## 3. Continuous Integration

These tests are designed to be run in a CI environment. Ensure the `API_URL` is correctly set in your CI environment variables.
