// integration_test/e2e_individual/34_guarantor_form_test.dart
//
// Standalone test: Complete Guarantor form.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/34_guarantor_form_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../pages/app_robots.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Guarantor Form E2E: Direct routing and submission',
      (tester) async {
    final app = AppRobots(tester);
    await resetAppState();
    await launchApp(tester);

    // 1. Auth Flow
    await handlePreamble(tester);
    await completeAuthFlow(tester, phone: TestCredentials.phone);

    // 2. Wait for Intent Screen
    await waitFor(tester, find.text('Deliver with Us'));
    await tester.tap(find.text('Deliver with Us'));
    await settle(tester);
    await tester.tap(find.text('Confirm Selection'));
    await settle(tester);

    // 3. User Form
    await waitFor(tester, app.onboarding.fullNameField);
    await tester.enterText(
        app.onboarding.fullNameField, TestCredentials.fullName);
    await tester.enterText(app.onboarding.emailField, TestCredentials.email);
    await tester.enterText(
        app.onboarding.fatherNameField, TestCredentials.fatherName);
    await tester.enterText(
        app.onboarding.motherNameField, TestCredentials.motherName);
    await settle(tester);

    // Pick DOB
    await tester.tap(find.text('DD-MM-YYYY'));
    await settle(tester);
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.text('OK'));
    await settle(tester);

    // Submit User Form
    await tester.tap(app.onboarding.nextOnboardingButton);
    await settle(tester);

    // 4. Verify direct routing to Guarantor Form
    await waitFor(tester, find.text('Guarantor Details'));
    expect(app.onboarding.guarantorNameField, findsOneWidget);

    // 5. Fill Guarantor Form
    await tester.enterText(
        app.onboarding.guarantorNameField, TestCredentials.guarantorName);
    await tester.enterText(
        app.onboarding.guarantorPhoneField, TestCredentials.guarantorPhone);
    await tester.enterText(
        app.onboarding.guarantorFatherNameField, TestCredentials.fatherName);
    await tester.enterText(
        app.onboarding.guarantorMotherNameField, TestCredentials.motherName);
    await tester.enterText(app.shared.guarantorAddressField, '123 Test Ave');
    await settle(tester);

    // Test Mode bypasses document uploads automatically, so we just tap Finish
    await tester.tap(app.onboarding.completeOnboardingButton);
    await settle(tester);

    // 6. Verify routing to PreDashboard
    await waitFor(
        tester, find.text('Start Registration').or(find.text('Book Vehicle')));
    expect(app.shared.preDashboardScreen, findsWidgets);
  });
}
