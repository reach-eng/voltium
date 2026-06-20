// integration_test/app_test.dart
//
// Voltium – Full end-to-end integration test for the Android client.
// Covers: Auth → Onboarding → Plan → Pickup → Dashboard → Wallet →
//         Rewards → Profile → Support → SOS → Notifications → Logout
//
// Run with:
//   flutter test integration_test/app_test.dart \
//     --dart-define=API_URL=http://10.0.2.2:8081 \
//     -d <android-emulator-id>

import 'package:flutter_test/flutter_test.dart';
import 'helpers/test_helpers.dart';
import 'package:integration_test/integration_test.dart';
import 'package:flutter/material.dart';
import 'package:voltium_rider/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Voltium Full E2E', () {
    // Test data – any 10-digit phone works with the dev backend
    const testPhone = '9876543210';
    const testOtp = '111111';

    // -----------------------------------------------------------------------
    // Helper: wait for a widget to appear (with retries)
    // -----------------------------------------------------------------------
    Future<void> waitFor(
      WidgetTester tester,
      Finder finder, {
      Duration timeout = const Duration(seconds: 10),
    }) async {
      final end = DateTime.now().add(timeout);
      while (DateTime.now().isBefore(end)) {
        await tester.pump(const Duration(milliseconds: 500));
        if (finder.evaluate().isNotEmpty) return;
      }
      fail('Widget not found within ${timeout.inSeconds}s: $finder');
    }

    // -----------------------------------------------------------------------
    // 1. Authentication flow
    // -----------------------------------------------------------------------
    testWidgets('Step 1 – Authentication (Login + OTP)', (tester) async {
      await app.main();
      await settle(tester);

      // Wait for splash -> Choice or Legal screen
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      // Handle AuthChoiceScreen if present
      final loginPhoneBtn = find.byKey(const Key('loginWithPhoneButton'));
      final createAccountBtn = find.byKey(const Key('createAccountButton'));

      if (loginPhoneBtn.evaluate().isNotEmpty) {
        await tester.tap(loginPhoneBtn);
        await settle(tester);
      } else if (createAccountBtn.evaluate().isNotEmpty) {
        await tester.tap(createAccountBtn);
        await settle(tester);
      }

      // Legal screen – accept terms
      final acceptCheckbox = find.byKey(const Key('acceptCheckbox'));
      if (acceptCheckbox.evaluate().isNotEmpty) {
        await tester.tap(acceptCheckbox);
        await settle(tester);
        await tester.tap(find.byKey(const Key('continueLegalButton')));
        await settle(tester);
      }

      // Permissions screen
      final permContinue = find.byKey(const Key('continuePermissionsButton'));
      if (permContinue.evaluate().isNotEmpty) {
        await tester.tap(permContinue);
        await settle(tester);
      }

      // Login screen
      await waitFor(tester, find.byKey(const Key('phoneInput')));
      await tester.enterText(
        find.byKey(const Key('phoneInput')),
        testPhone,
      );
      await settle(tester);
      await tester.ensureVisible(find.byKey(const Key('sendOtpButton')));
      await tester.tap(find.byKey(const Key('sendOtpButton')));
      await settle(tester);

      // OTP screen
      await waitFor(tester, find.byKey(const Key('otpInputRow')));
      final otpRow = find.byKey(const Key('otpInputRow'));
      final otpFields =
          find.descendant(of: otpRow, matching: find.byType(TextField));
      for (int i = 0; i < 6; i++) {
        await tester.enterText(otpFields.at(i), '1');
        await tester.pump();
      }
      await settle(tester);
      await tester.ensureVisible(find.byKey(const Key('verifyOtpButton')));
      await tester.tap(find.byKey(const Key('verifyOtpButton')));
      await settle(tester);

      // Should reach auth wrapper / onboarding or dashboard
      await tester.pump(const Duration(seconds: 3));
      await settle(tester);
    });

    // -----------------------------------------------------------------------
    // 2. Onboarding flow (if rider is new)
    // -----------------------------------------------------------------------
    testWidgets('Step 2 – Onboarding', (tester) async {
      await app.main();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      // Intent of use screen
      final intentCard = find.text('Deliver with Us');
      if (intentCard.evaluate().isNotEmpty) {
        await tester.tap(intentCard);
        await settle(tester);
        await tester.tap(find.text('Confirm Selection'));
        await settle(tester);
      }

      // User onboarding screen
      final userOnboardingTitle = find.text('Secure\nVerification.');
      if (userOnboardingTitle.evaluate().isNotEmpty) {
        await tester.enterText(
          find.byKey(const Key('fullNameField')),
          'Test Rider',
        );
        await tester.enterText(
          find.byKey(const Key('emailField')),
          'test@example.com',
        );
        await tester.enterText(
          find.byKey(const Key('fatherNameField')),
          'Test Father',
        );
        await tester.enterText(
          find.byKey(const Key('motherNameField')),
          'Test Mother',
        );
        await settle(tester);
        await tester.tap(find.byKey(const Key('nextOnboardingButton')));
        await settle(tester);
      }

      // Guarantor onboarding screen
      final guarantorTitle = find.text('Add a trusted backer.');
      if (guarantorTitle.evaluate().isNotEmpty) {
        await tester.enterText(
          find.byKey(const Key('guarantorNameField')),
          'Guarantor Name',
        );
        await tester.enterText(
          find.byKey(const Key('guarantorPhoneField')),
          '9998887776',
        );
        await settle(tester);
        await tester.tap(find.byKey(const Key('completeOnboardingButton')));
        await settle(tester);
      }

      await tester.pump(const Duration(seconds: 3));
      await settle(tester);
    });

    // -----------------------------------------------------------------------
    // 3. Plan selection
    // -----------------------------------------------------------------------
    testWidgets('Step 3 – Plan Selection', (tester) async {
      await app.main();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      final planCard = find.byKey(const Key('planCard'));
      if (planCard.evaluate().isNotEmpty) {
        await tester.tap(planCard.first);
        await settle(tester);
        await tester.tap(find.byKey(const Key('confirmPlanButton')));
        await settle(tester);
      }

      await tester.pump(const Duration(seconds: 2));
      await settle(tester);
    });

    // -----------------------------------------------------------------------
    // 4. Vehicle pickup flow
    // -----------------------------------------------------------------------
    testWidgets('Step 4 – Vehicle Pickup', (tester) async {
      await app.main();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      // Pickup hub
      final hubCard = find.byKey(const Key('hubCard'));
      if (hubCard.evaluate().isNotEmpty) {
        await tester.tap(hubCard.first);
        await settle(tester);
        await tester.tap(find.byKey(const Key('confirmHubButton')));
        await settle(tester);
      }

      // Pickup vehicle
      final vehicleField = find.byKey(const Key('vehicleIdField'));
      if (vehicleField.evaluate().isNotEmpty) {
        await tester.enterText(vehicleField, 'VH-TEST-001');
        await settle(tester);
        await tester.tap(find.byKey(const Key('verifyVehicleButton')));
        await settle(tester);
      }

      // Inspection checklist
      final inspectionItems = [
        'inspectionItem1',
        'inspectionItem2',
        'inspectionItem3',
        'inspectionItem4',
        'inspectionItem5',
        'inspectionItem6',
        'inspectionItem7',
      ];
      for (final key in inspectionItems) {
        final item = find.byKey(Key(key));
        if (item.evaluate().isNotEmpty) {
          await tester.tap(item);
          await settle(tester);
        }
      }
      await tester.tap(find.byKey(const Key('capturePickupPhotoButton')));
      await settle(tester);

      // Verification
      final uploadArea = find.byKey(const Key('uploadPhotoArea'));
      if (uploadArea.evaluate().isNotEmpty) {
        await tester.tap(find.byKey(const Key('rentalAgreementCheckbox')));
        await settle(tester);
        await tester.tap(find.byKey(const Key('completePickupButton')));
        await settle(tester);
      }

      await tester.pump(const Duration(seconds: 2));
      await settle(tester);
    });

    // -----------------------------------------------------------------------
    // 5. Dashboard verification
    // -----------------------------------------------------------------------
    testWidgets('Step 5 – Dashboard', (tester) async {
      await app.main();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      // Dashboard should be loaded (check for bottom nav)
      final dashboardTab = find.byKey(const Key('dashboardTab'));
      if (dashboardTab.evaluate().isEmpty) {
        // Might be on Auth Choice screen
        final loginPhoneBtn = find.byKey(const Key('loginWithPhoneButton'));
        if (loginPhoneBtn.evaluate().isNotEmpty) {
          await tester.tap(loginPhoneBtn);
          await settle(tester);
        }
        // Check for NavigationBar as fallback
        if (find.byType(NavigationBar).evaluate().isEmpty) {
          print('Dashboard not found, dumping app state:');
          debugDumpApp();
        }
        expect(find.byKey(const Key('dashboardTab')), findsOneWidget);
      } else {
        await tester.tap(dashboardTab);
        await settle(tester);
      }

      // Verify key dashboard elements
      expect(find.byKey(const Key('notificationBell')), findsOneWidget);
      expect(find.byKey(const Key('pointsBadge')), findsOneWidget);
      expect(find.byKey(const Key('assignedVehicleCard')), findsOneWidget);
    });

    // -----------------------------------------------------------------------
    // 6. Wallet & top-up
    // -----------------------------------------------------------------------
    testWidgets('Step 6 – Wallet & Top-up', (tester) async {
      await app.main();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      // Navigate to wallet tab
      await tester.tap(find.byKey(const Key('walletTab')));
      await settle(tester);

      // Top up — open dialog
      await tester.tap(find.byKey(const Key('topUpButton')));
      await settle(tester);

      // Enter top-up amount
      final amountField = find.byKey(const Key('topUpAmountField'));
      if (amountField.evaluate().isNotEmpty) {
        await tester.enterText(amountField, '500');
        await settle(tester);
      }

      // Submit top-up
      final submitBtn = find.byKey(const Key('submitTopUpButton'));
      if (submitBtn.evaluate().isNotEmpty) {
        await tester.tap(submitBtn);
        await settle(tester);
      }

      await tester.pump(const Duration(seconds: 2));
      await settle(tester);
    });

    // -----------------------------------------------------------------------
    // 7. Rewards
    // -----------------------------------------------------------------------
    testWidgets('Step 7 – Rewards', (tester) async {
      await app.main();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      // Navigate to profile → rewards
      await tester.tap(find.byKey(const Key('profileTab')));
      await settle(tester);
      await tester.tap(find.byKey(const Key('rewardsLink')));
      await settle(tester);

      // Verify rewards screen loaded
      expect(find.byKey(const Key('backButton')), findsOneWidget);

      // Go back
      await tester.tap(find.byKey(const Key('backButton')));
      await settle(tester);
    });

    // -----------------------------------------------------------------------
    // 8. Profile editing
    // -----------------------------------------------------------------------
    testWidgets('Step 8 – Edit Profile', (tester) async {
      await app.main();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      await tester.tap(find.byKey(const Key('profileTab')));
      await settle(tester);
      await tester.tap(find.byKey(const Key('editProfileLink')));
      await settle(tester);

      // Edit fields
      await tester.enterText(
        find.byKey(const Key('editFullNameField')),
        'Updated Name',
      );
      await tester.enterText(
        find.byKey(const Key('editEmailField')),
        'updated@example.com',
      );
      await settle(tester);
      await tester.tap(find.byKey(const Key('submitProfileButton')));
      await settle(tester);

      await tester.pump(const Duration(seconds: 2));
      await settle(tester);
    });

    // -----------------------------------------------------------------------
    // 9. Support ticket
    // -----------------------------------------------------------------------
    testWidgets('Step 9 – Support Ticket', (tester) async {
      await app.main();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      await tester.tap(find.byKey(const Key('supportTab')));
      await settle(tester);

      // Fill ticket
      await tester.tap(find.byKey(const Key('issueTypeDropdown')));
      await settle(tester);
      // Select first dropdown item
      await tester.tap(find.text('Payment Issue').first);
      await settle(tester);

      await tester.enterText(
        find.byKey(const Key('ticketDescriptionField')),
        'Test support ticket from integration test',
      );
      await settle(tester);
      await tester.tap(find.byKey(const Key('raiseTicketButton')));
      await settle(tester);

      await tester.pump(const Duration(seconds: 2));
      await settle(tester);
    });

    // -----------------------------------------------------------------------
    // 10. Emergency SOS
    // -----------------------------------------------------------------------
    testWidgets('Step 10 – Emergency SOS', (tester) async {
      await app.main();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      await tester.tap(find.byKey(const Key('profileTab')));
      await settle(tester);
      await tester.tap(find.byKey(const Key('emergencySosLink')));
      await settle(tester);

      // Verify SOS screen elements
      expect(find.byKey(const Key('sosTriggerButton')), findsOneWidget);
      expect(find.byKey(const Key('emergencyContact1')), findsOneWidget);

      // Cancel and go back
      await tester.tap(find.byKey(const Key('cancelSosButton')));
      await settle(tester);
    });

    // -----------------------------------------------------------------------
    // 11. Notifications
    // -----------------------------------------------------------------------
    testWidgets('Step 11 – Notifications', (tester) async {
      await app.main();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      // Tap notification bell on dashboard
      await tester.tap(find.byKey(const Key('notificationBell')));
      await settle(tester);

      // Mark all read
      final markAllRead = find.byKey(const Key('markAllReadButton'));
      if (markAllRead.evaluate().isNotEmpty) {
        await tester.tap(markAllRead);
        await settle(tester);
      }

      // Go back
      await tester.pageBack();
      await settle(tester);
    });

    // -----------------------------------------------------------------------
    // 12. Logout
    // -----------------------------------------------------------------------
    testWidgets('Step 12 – Logout', (tester) async {
      await app.main();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      await tester.tap(find.byKey(const Key('profileTab')));
      await settle(tester);
      await tester.tap(find.byKey(const Key('logoutButton')));
      await settle(tester);

      // Should be back at login screen
      await tester.pump(const Duration(seconds: 3));
      await settle(tester);

      expect(find.byKey(const Key('phoneInput')), findsOneWidget);
    });

    // -----------------------------------------------------------------------
    // 13. Full end-to-end chain (all steps in one test)
    // -----------------------------------------------------------------------
    testWidgets('Full Journey – All flows chained', (tester) async {
      await app.main();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      // --- Auth ---
      final acceptCheckbox = find.byKey(const Key('acceptCheckbox'));
      if (acceptCheckbox.evaluate().isNotEmpty) {
        await tester.tap(acceptCheckbox);
        await settle(tester);
        await tester.tap(find.byKey(const Key('continueLegalButton')));
        await settle(tester);
      }

      final permContinue = find.byKey(const Key('continuePermissionsButton'));
      if (permContinue.evaluate().isNotEmpty) {
        await tester.tap(permContinue);
        await settle(tester);
      }

      await waitFor(tester, find.byKey(const Key('phoneInput')));
      await tester.enterText(
        find.byKey(const Key('phoneInput')),
        testPhone,
      );
      await settle(tester);
      await tester.tap(find.byKey(const Key('sendOtpButton')));
      await settle(tester);

      await waitFor(tester, find.byKey(const Key('otpInputRow')));
      final otpRow2 = find.byKey(const Key('otpInputRow'));
      final otpFields2 =
          find.descendant(of: otpRow2, matching: find.byType(TextField));
      for (int i = 0; i < 6; i++) {
        await tester.enterText(otpFields2.at(i), '1');
        await tester.pump();
      }
      await settle(tester);
      await tester.tap(find.byKey(const Key('verifyOtpButton')));
      await settle(tester);
      await tester.pump(const Duration(seconds: 3));
      await settle(tester);

      // --- Onboarding (if shown) ---
      final intentCard = find.text('Deliver with Us');
      if (intentCard.evaluate().isNotEmpty) {
        await tester.tap(intentCard);
        await settle(tester);
        await tester.tap(find.text('Confirm Selection'));
        await settle(tester);
      }

      final userOnboardingTitle = find.text('Secure\nVerification.');
      if (userOnboardingTitle.evaluate().isNotEmpty) {
        await tester.enterText(
          find.byKey(const Key('fullNameField')),
          'Test Rider',
        );
        await tester.enterText(
          find.byKey(const Key('emailField')),
          'test@example.com',
        );
        await tester.enterText(
          find.byKey(const Key('fatherNameField')),
          'Test Father',
        );
        await tester.enterText(
          find.byKey(const Key('motherNameField')),
          'Test Mother',
        );
        await settle(tester);
        await tester.tap(find.byKey(const Key('nextOnboardingButton')));
        await settle(tester);
      }

      final guarantorTitle = find.text('Add a trusted backer.');
      if (guarantorTitle.evaluate().isNotEmpty) {
        await tester.enterText(
          find.byKey(const Key('guarantorNameField')),
          'Guarantor Name',
        );
        await tester.enterText(
          find.byKey(const Key('guarantorPhoneField')),
          '9998887776',
        );
        await settle(tester);
        await tester.tap(find.byKey(const Key('completeOnboardingButton')));
        await settle(tester);
      }

      // --- Plan (if shown) ---
      final planCard = find.byKey(const Key('planCard'));
      if (planCard.evaluate().isNotEmpty) {
        await tester.tap(planCard.first);
        await settle(tester);
        await tester.tap(find.byKey(const Key('confirmPlanButton')));
        await settle(tester);
      }

      // --- Pickup (if shown) ---
      final hubCard = find.byKey(const Key('hubCard'));
      if (hubCard.evaluate().isNotEmpty) {
        await tester.tap(hubCard.first);
        await settle(tester);
        await tester.tap(find.byKey(const Key('confirmHubButton')));
        await settle(tester);
      }

      // --- Dashboard verification ---
      await tester.pump(const Duration(seconds: 3));
      await settle(tester);
      expect(find.byKey(const Key('dashboardTab')), findsOneWidget);

      // --- Wallet ---
      await tester.tap(find.byKey(const Key('walletTab')));
      await settle(tester);
      expect(find.byKey(const Key('topUpButton')), findsOneWidget);

      // --- Profile ---
      await tester.tap(find.byKey(const Key('profileTab')));
      await settle(tester);
      expect(find.byKey(const Key('editProfileLink')), findsOneWidget);
      expect(find.byKey(const Key('logoutButton')), findsOneWidget);

      // --- Support ---
      await tester.tap(find.byKey(const Key('supportTab')));
      await settle(tester);
      expect(find.byKey(const Key('raiseTicketButton')), findsOneWidget);

      // --- Back to dashboard ---
      await tester.tap(find.byKey(const Key('dashboardTab')));
      await settle(tester);
      expect(find.byKey(const Key('notificationBell')), findsOneWidget);

      // --- Logout ---
      await tester.tap(find.byKey(const Key('profileTab')));
      await settle(tester);
      await tester.tap(find.byKey(const Key('logoutButton')));
      await settle(tester);
      await tester.pump(const Duration(seconds: 3));
      await settle(tester);

      // Verify back at login
      expect(find.byKey(const Key('phoneInput')), findsOneWidget);

      print('✅ Full journey completed successfully!');
    });
  });
}
