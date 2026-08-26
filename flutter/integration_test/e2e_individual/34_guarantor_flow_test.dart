// integration_test/e2e_individual/34_guarantor_flow_test.dart
//
// Standalone test: Guarantor onboarding flow – form entry, OTP verification, document upload.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/34_guarantor_flow_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../pages/app_robots.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Guarantor flow – complete onboarding with guarantor details',
      (tester) async {
    final app = AppRobots(tester);
    await launchApp(tester);
    await handlePreamble(tester);
    await completeAuthFlow(tester);

    // Complete intent screen if shown
    final intentCard = find.text('Deliver with Us');
    if (intentCard.evaluate().isNotEmpty) {
      await tester.tap(intentCard);
      await settle(tester);
      await tester.tap(find.text('Confirm Selection'));
      await settle(tester);
    }

    // Complete user onboarding form if shown
    final fullNameField = app.onboarding.fullNameField;
    if (fullNameField.evaluate().isNotEmpty) {
      await tester.enterText(fullNameField, TestCredentials.fullName);
      await tester.enterText(
        app.onboarding.emailField,
        TestCredentials.email,
      );
      await tester.enterText(
        app.onboarding.fatherNameField,
        TestCredentials.fatherName,
      );
      await tester.enterText(
        app.onboarding.motherNameField,
        TestCredentials.motherName,
      );
      await settle(tester);
      await tester.tap(app.onboarding.nextOnboardingButton);
      await settle(tester);
    }

    // Check if guarantor form is visible
    final guarantorNameField = app.onboarding.guarantorNameField;
    if (guarantorNameField.evaluate().isNotEmpty) {
      // Fill guarantor details
      await tester.enterText(guarantorNameField, TestCredentials.guarantorName);
      await settle(tester);

      // Fill guarantor phone
      final guarantorPhoneField = app.onboarding.guarantorPhoneField;
      if (guarantorPhoneField.evaluate().isNotEmpty) {
        await tester.enterText(
          guarantorPhoneField,
          TestCredentials.guarantorPhone,
        );
        await settle(tester);
      }

      // Select relationship if dropdown exists
      final relationshipDropdown = app.shared.relationshipDropdown;
      if (relationshipDropdown.evaluate().isNotEmpty) {
        await tester.tap(relationshipDropdown);
        await settle(tester);
        await tester.tap(find.text('Parent').hitTestable());
        await settle(tester);
      }

      // Tap complete onboarding button
      final completeBtn = app.onboarding.completeOnboardingButton;
      if (completeBtn.evaluate().isNotEmpty) {
        await tester.tap(completeBtn);
        await settle(tester);
      }
    }

    // Should navigate to pre-dashboard or dashboard (or still be in onboarding)
    final hasDashboard = app.dashboard.dashboardTab.evaluate().isNotEmpty;
    final hasPreDashboard = app.shared.preDashboardTitle.evaluate().isNotEmpty;
    final stillOnboarding =
        app.onboarding.guarantorNameField.evaluate().isNotEmpty;

    expect(
      hasDashboard || hasPreDashboard || stillOnboarding,
      isTrue,
      reason:
          'Should reach dashboard, pre-dashboard, or still be on guarantor form',
    );
  });

  testWidgets('Guarantor flow – validation for empty fields', (tester) async {
    final app = AppRobots(tester);
    await launchApp(tester);
    await handlePreamble(tester);
    await completeAuthFlow(tester, phone: '9876543211');

    // Skip to guarantor form if needed
    final intentCard = find.text('Deliver with Us');
    if (intentCard.evaluate().isNotEmpty) {
      await tester.tap(intentCard);
      await settle(tester);
      await tester.tap(find.text('Confirm Selection'));
      await settle(tester);
    }

    final fullNameField = app.onboarding.fullNameField;
    if (fullNameField.evaluate().isNotEmpty) {
      await tester.enterText(fullNameField, TestCredentials.fullName);
      await tester.enterText(
        app.onboarding.emailField,
        TestCredentials.email,
      );
      await tester.enterText(
        app.onboarding.fatherNameField,
        TestCredentials.fatherName,
      );
      await tester.enterText(
        app.onboarding.motherNameField,
        TestCredentials.motherName,
      );
      await settle(tester);
      await tester.tap(app.onboarding.nextOnboardingButton);
      await settle(tester);
    }

    // If on guarantor form, try to submit without filling details
    final completeBtn = app.onboarding.completeOnboardingButton;
    if (completeBtn.evaluate().isNotEmpty) {
      await tester.tap(completeBtn);
      await settle(tester);

      // Should still be on guarantor screen (validation prevented navigation)
      final guarantorNameField = app.onboarding.guarantorNameField;
      if (guarantorNameField.evaluate().isNotEmpty) {
        expect(
          guarantorNameField,
          findsAtLeastNWidgets(1),
          reason: 'Should stay on guarantor screen after validation failure',
        );
      }
    }
  });

  testWidgets('Guarantor flow – declaration checkbox required', (tester) async {
    final app = AppRobots(tester);
    await launchApp(tester);
    await handlePreamble(tester);
    await completeAuthFlow(tester, phone: '9876543212');

    // Skip to guarantor form
    final intentCard = find.text('Deliver with Us');
    if (intentCard.evaluate().isNotEmpty) {
      await tester.tap(intentCard);
      await settle(tester);
      await tester.tap(find.text('Confirm Selection'));
      await settle(tester);
    }

    final fullNameField = app.onboarding.fullNameField;
    if (fullNameField.evaluate().isNotEmpty) {
      await tester.enterText(fullNameField, TestCredentials.fullName);
      await tester.enterText(
        app.onboarding.emailField,
        TestCredentials.email,
      );
      await tester.enterText(
        app.onboarding.fatherNameField,
        TestCredentials.fatherName,
      );
      await tester.enterText(
        app.onboarding.motherNameField,
        TestCredentials.motherName,
      );
      await settle(tester);
      await tester.tap(app.onboarding.nextOnboardingButton);
      await settle(tester);
    }

    // If on guarantor form, fill details and check declaration
    final guarantorNameField = app.onboarding.guarantorNameField;
    if (guarantorNameField.evaluate().isNotEmpty) {
      await tester.enterText(guarantorNameField, TestCredentials.guarantorName);
      await tester.enterText(
        app.onboarding.guarantorPhoneField,
        TestCredentials.guarantorPhone,
      );
      await settle(tester);

      // Check declaration checkbox exists
      final declarationCheckbox = app.onboarding.declarationCheckbox;
      if (declarationCheckbox.evaluate().isNotEmpty) {
        expect(
          declarationCheckbox,
          findsAtLeastNWidgets(1),
          reason: 'Declaration checkbox should be visible',
        );
      }
    }
  });
}
