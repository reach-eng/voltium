// integration_test/e2e_individual/05_otp_verification_test.dart
//
// Standalone test: OTP verification flow.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/05_otp_verification_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../pages/app_robots.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('OTP verification – auth flow completes successfully',
      (tester) async {
    final app = AppRobots(tester);
    final reachedDashboard = await fullLoginFlow(tester);

    // Should reach at least onboarding or dashboard
    final hasOnboarding = app.onboarding.fullNameField.evaluate().isNotEmpty;
    final hasDashboard = app.dashboard.dashboardTab.evaluate().isNotEmpty;

    expect(
      reachedDashboard || hasOnboarding || hasDashboard,
      isTrue,
      reason: 'Should reach onboarding or dashboard after OTP verification',
    );
  });
}
