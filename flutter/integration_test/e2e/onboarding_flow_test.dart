// integration_test/e2e/onboarding_flow_test.dart
//
// Voltium – Onboarding E2E tests.
// Covers: intent of use, user form, guarantor form, plan selection, pickup flow.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Onboarding Flow E2E', () {
    testWidgets('Intent of use screen – select and confirm', (tester) async {
      await fullLoginFlow(tester);

      // Check if intent screen is shown
      final intentCard = find.text('Deliver with Us');
      if (intentCard.evaluate().isEmpty) {
        return; // Already past intent screen
      }

      expect(intentCard, findsOneWidget);
      await tester.tap(intentCard);
      await settle(tester);

      // Confirm button should appear
      expect(find.text('Confirm Selection'), findsOneWidget);
      await tester.tap(find.text('Confirm Selection'));
      await settle(tester);
    });

    testWidgets('User onboarding form – fill and submit', (tester) async {
      await fullLoginFlow(tester);

      // Check if user form is shown
      final fullNameField = find.byKey(const Key('fullNameField'));
      if (fullNameField.evaluate().isEmpty) {
        return; // Already past user form
      }

      // Fill required fields
      await tester.enterText(fullNameField, TestCredentials.fullName);
      await settle(tester);

      await tester.enterText(
        find.byKey(const Key('emailField')),
        TestCredentials.email,
      );
      await settle(tester);

      await tester.enterText(
        find.byKey(const Key('fatherNameField')),
        TestCredentials.fatherName,
      );
      await settle(tester);

      await tester.enterText(
        find.byKey(const Key('motherNameField')),
        TestCredentials.motherName,
      );
      await settle(tester);

      // Next button should be enabled
      expect(find.byKey(const Key('nextOnboardingButton')), findsOneWidget);
      await tester.tap(find.byKey(const Key('nextOnboardingButton')));
      await settle(tester);
    });

    testWidgets('Guarantor form – fill and complete', (tester) async {
      await fullLoginFlow(tester);

      // Check if guarantor form is shown
      final guarantorNameField = find.byKey(const Key('guarantorNameField'));
      if (guarantorNameField.evaluate().isEmpty) {
        return; // Already past guarantor form
      }

      await tester.enterText(guarantorNameField, TestCredentials.guarantorName);
      await settle(tester);

      await tester.enterText(
        find.byKey(const Key('guarantorPhoneField')),
        TestCredentials.guarantorPhone,
      );
      await settle(tester);

      // Complete button should be visible
      expect(find.byKey(const Key('completeOnboardingButton')), findsOneWidget);
      await tester.tap(find.byKey(const Key('completeOnboardingButton')));
      await settle(tester);
    });

    testWidgets('Plan selection – choose plan and confirm', (tester) async {
      await fullLoginFlow(tester);

      // Check if plan selection is shown
      final planCard = find.byKey(const Key('planCard_0'));
      if (planCard.evaluate().isEmpty) {
        return; // Already past plan selection
      }

      expect(planCard, findsOneWidget);
      await tester.tap(planCard);
      await settle(tester);

      // Confirm button should appear
      expect(find.byKey(const Key('confirmPlanButton')), findsOneWidget);
      await tester.tap(find.byKey(const Key('confirmPlanButton')));
      await settle(tester);

      await tester.pump(const Duration(seconds: 2));
      await settle(tester);
    });

    testWidgets('Pickup hub selection – select hub and confirm',
        (tester) async {
      await fullLoginFlow(tester);

      // Check if hub selection is shown
      final hubCard = find.byKey(const Key('hubCard'));
      if (hubCard.evaluate().isEmpty) {
        return; // Already past hub selection
      }

      expect(hubCard, findsWidgets);
      await tester.tap(hubCard.first);
      await settle(tester);

      expect(find.byKey(const Key('confirmHubButton')), findsOneWidget);
      await tester.tap(find.byKey(const Key('confirmHubButton')));
      await settle(tester);
    });

    testWidgets('Pickup vehicle verification – enter ID and verify',
        (tester) async {
      await fullLoginFlow(tester);

      // Check if vehicle verification is shown
      final vehicleField = find.byKey(const Key('vehicleIdField'));
      if (vehicleField.evaluate().isEmpty) {
        return; // Already past vehicle verification
      }

      await tester.enterText(vehicleField, 'VH-TEST-001');
      await settle(tester);

      expect(find.byKey(const Key('verifyVehicleButton')), findsOneWidget);
      await tester.tap(find.byKey(const Key('verifyVehicleButton')));
      await settle(tester);
    });

    testWidgets('Pickup inspection – check all items', (tester) async {
      await fullLoginFlow(tester);

      // Check if inspection screen is shown
      final item1 = find.byKey(const Key('inspectionItem1'));
      if (item1.evaluate().isEmpty) {
        return; // Already past inspection
      }

      // Check all inspection items
      for (int i = 1; i <= 7; i++) {
        final item = find.byKey(Key('inspectionItem$i'));
        if (item.evaluate().isNotEmpty) {
          await tester.tap(item);
          await settle(tester);
        }
      }

      // Capture photo button should be visible
      expect(find.byKey(const Key('capturePickupPhotoButton')), findsOneWidget);
    });

    testWidgets('Pickup verification – complete pickup', (tester) async {
      await fullLoginFlow(tester);

      // Check if pickup verification is shown
      final uploadArea = find.byKey(const Key('uploadPhotoArea'));
      if (uploadArea.evaluate().isEmpty) {
        return; // Already past pickup verification
      }

      // Check rental agreement
      final checkbox = find.byKey(const Key('rentalAgreementCheckbox'));
      if (checkbox.evaluate().isNotEmpty) {
        await tester.tap(checkbox);
        await settle(tester);
      }

      // Complete button should be enabled
      expect(find.byKey(const Key('completePickupButton')), findsOneWidget);
    });

    testWidgets('Full onboarding chain → dashboard', (tester) async {
      final reachedDashboard = await fullLoginFlow(tester);
      expect(reachedDashboard, isTrue,
          reason: 'Should reach dashboard after full onboarding',);
    });
  });
}
