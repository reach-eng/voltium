// integration_test/e2e_individual/05_otp_verification_test.dart
//
// Standalone test: OTP verification flow.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/05_otp_verification_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('OTP verification – auth flow completes successfully',
      (tester) async {
    final reachedDashboard = await fullLoginFlow(tester);

    // Should reach at least onboarding or dashboard
    final hasOnboarding =
        find.byKey(const Key('fullNameField')).evaluate().isNotEmpty;
    final hasDashboard =
        find.byKey(const Key('dashboardTab')).evaluate().isNotEmpty;

    expect(
      reachedDashboard || hasOnboarding || hasDashboard,
      isTrue,
      reason: 'Should reach onboarding or dashboard after OTP verification',
    );
  });
}
