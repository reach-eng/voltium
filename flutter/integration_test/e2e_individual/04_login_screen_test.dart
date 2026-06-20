// integration_test/e2e_individual/04_login_screen_test.dart
//
// Standalone test: Login screen – phone entry and OTP send.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/04_login_screen_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Login screen – enter phone and navigate to OTP', (tester) async {
    await launchApp(tester);

    // Complete pre-login screens and auth flow
    await completeAuthFlow(tester);

    // Should reach OTP screen or beyond (legal, permissions, intent of use, user onboarding, guarantor onboarding, dashboard)
    final hasOtp = find.byKey(const Key('otpInputRow')).evaluate().isNotEmpty;
    final hasLegal =
        find.byKey(const Key('acceptCheckbox')).evaluate().isNotEmpty;
    final hasPermissions = find
        .byKey(const Key('continuePermissionsButton'))
        .evaluate()
        .isNotEmpty;
    final hasIntent =
        find.byKey(const Key('deliverWithUsCard')).evaluate().isNotEmpty;
    final hasOnboarding =
        find.byKey(const Key('fullNameField')).evaluate().isNotEmpty;
    final hasGuarantor =
        find.byKey(const Key('guarantorNameField')).evaluate().isNotEmpty;
    final hasDashboard =
        find.byKey(const Key('dashboardTab')).evaluate().isNotEmpty;

    expect(
      hasOtp ||
          hasLegal ||
          hasPermissions ||
          hasIntent ||
          hasOnboarding ||
          hasGuarantor ||
          hasDashboard,
      isTrue,
      reason:
          'Should reach OTP, Legal, Permissions, Intent, User onboarding, Guarantor onboarding, or dashboard after auth flow',
    );
  });
}
