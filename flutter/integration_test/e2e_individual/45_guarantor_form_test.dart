// integration_test/e2e_individual/45_guarantor_form_test.dart
//
// ONBOARDING-AUDIT 2026-08-14 (fix #1): the previous version of this
// test asserted the legacy pre-dashboard path
// (`Start Registration` / `Book Vehicle` / `preDashboardScreen`).
// After PR-ONBOARDING-FLOW-2026-08-12 the active path now routes
// guarantor → choosePlan, not guarantor → preDashboard. The
// pre-dashboard surface is no longer reached from the active path.
// The test has been re-shaped to assert on the plan-selection
// surface after the guarantor step.
//
// Standalone test: Complete Guarantor form.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/45_guarantor_form_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

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

    // 6. ONBOARDING-AUDIT 2026-08-14 (fix #1): the active path
    // advances guarantor → choosePlan, NOT guarantor →
    // preDashboard. The pre-dashboard surface is no longer reached
    // from this flow. Assert on the plan-selection screen instead.
    await waitFor(
      tester,
      find.text('Choose a rental plan').or(find.text('Pick a plan')),
      timeout: const Duration(seconds: 20),
    );
    expect(
      find.text('Choose a rental plan').or(find.text('Pick a plan')),
      findsAtLeastNWidgets(1),
      reason: 'Active path: guarantor should land on plan selection',
    );
  });
}
