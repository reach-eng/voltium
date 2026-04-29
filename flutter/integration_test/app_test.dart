// integration_test/app_test.dart
//
// VoltFleet – Full end-to-end integration test for the Android client.
// Covers: Auth → Onboarding → Plan → Pickup → Dashboard → Wallet →
//         Rewards → Profile → Support → SOS → Notifications → Logout
//
// Run with:
//   flutter test integration_test/app_test.dart \
//     --dart-define=API_URL=http://10.0.2.2:8081 \
//     -d <android-emulator-id>

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:voltfleet_rider/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('VoltFleet Full E2E', () {
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
        await tester.pumpAndSettle();
        if (finder.evaluate().isNotEmpty) return;
        await tester.pump(const Duration(milliseconds: 500));
      }
      fail('Widget not found within ${timeout.inSeconds}s: $finder');
    }

    // -----------------------------------------------------------------------
    // 1. Authentication flow
    // -----------------------------------------------------------------------
    testWidgets('Step 1 – Authentication (Login + OTP)', (tester) async {
      await app.main();
      await tester.pumpAndSettle();

      // Wait for splash → legal screen
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();

      // Legal screen – accept terms
      final acceptCheckbox = find.byKey(const Key('acceptCheckbox'));
      if (acceptCheckbox.evaluate().isNotEmpty) {
        await tester.tap(acceptCheckbox);
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('continueLegalButton')));
        await tester.pumpAndSettle();
      }

      // Permissions screen
      final permContinue = find.byKey(const Key('continuePermissionsButton'));
      if (permContinue.evaluate().isNotEmpty) {
        await tester.tap(permContinue);
        await tester.pumpAndSettle();
      }

      // Login screen
      await waitFor(tester, find.byKey(const Key('phoneInput')));
      await tester.enterText(
        find.byKey(const Key('phoneInput')),
        testPhone,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('sendOtpButton')));
      await tester.pumpAndSettle();

      // OTP screen
      await waitFor(tester, find.byKey(const Key('otpInput')));
      await tester.enterText(
        find.byKey(const Key('otpInput')),
        testOtp,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('verifyOtpButton')));
      await tester.pumpAndSettle();

      // Should reach auth wrapper / onboarding or dashboard
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();
    });

    // -----------------------------------------------------------------------
    // 2. Onboarding flow (if rider is new)
    // -----------------------------------------------------------------------
    testWidgets('Step 2 – Onboarding', (tester) async {
      await app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();

      // Intent of use screen
      final intentCard = find.text('Deliver with Us');
      if (intentCard.evaluate().isNotEmpty) {
        await tester.tap(intentCard);
        await tester.pumpAndSettle();
        await tester.tap(find.text('Confirm Selection'));
        await tester.pumpAndSettle();
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
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('nextOnboardingButton')));
        await tester.pumpAndSettle();
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
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('completeOnboardingButton')));
        await tester.pumpAndSettle();
      }

      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();
    });

    // -----------------------------------------------------------------------
    // 3. Plan selection
    // -----------------------------------------------------------------------
    testWidgets('Step 3 – Plan Selection', (tester) async {
      await app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();

      final planCard = find.byKey(const Key('planCard'));
      if (planCard.evaluate().isNotEmpty) {
        await tester.tap(planCard.first);
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('confirmPlanButton')));
        await tester.pumpAndSettle();
      }

      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
    });

    // -----------------------------------------------------------------------
    // 4. Vehicle pickup flow
    // -----------------------------------------------------------------------
    testWidgets('Step 4 – Vehicle Pickup', (tester) async {
      await app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();

      // Pickup hub
      final hubCard = find.byKey(const Key('hubCard'));
      if (hubCard.evaluate().isNotEmpty) {
        await tester.tap(hubCard.first);
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('confirmHubButton')));
        await tester.pumpAndSettle();
      }

      // Pickup vehicle
      final vehicleField = find.byKey(const Key('vehicleIdField'));
      if (vehicleField.evaluate().isNotEmpty) {
        await tester.enterText(vehicleField, 'VH-TEST-001');
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('verifyVehicleButton')));
        await tester.pumpAndSettle();
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
          await tester.pumpAndSettle();
        }
      }
      await tester.tap(find.byKey(const Key('capturePickupPhotoButton')));
      await tester.pumpAndSettle();

      // Verification
      final uploadArea = find.byKey(const Key('uploadPhotoArea'));
      if (uploadArea.evaluate().isNotEmpty) {
        await tester.tap(find.byKey(const Key('rentalAgreementCheckbox')));
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('completePickupButton')));
        await tester.pumpAndSettle();
      }

      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
    });

    // -----------------------------------------------------------------------
    // 5. Dashboard verification
    // -----------------------------------------------------------------------
    testWidgets('Step 5 – Dashboard', (tester) async {
      await app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();

      // Dashboard should be loaded (check for bottom nav)
      final dashboardTab = find.byKey(const Key('dashboardTab'));
      if (dashboardTab.evaluate().isEmpty) {
        // Might already be on dashboard
        expect(find.byType(NavigationBar), findsOneWidget);
      } else {
        await tester.tap(dashboardTab);
        await tester.pumpAndSettle();
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
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();

      // Navigate to wallet tab
      await tester.tap(find.byKey(const Key('walletTab')));
      await tester.pumpAndSettle();

      // Top up
      await tester.tap(find.byKey(const Key('topUpButton')));
      await tester.pumpAndSettle();

      // Select amount
      final amount500 = find.byKey(const Key('amount500'));
      if (amount500.evaluate().isNotEmpty) {
        await tester.tap(amount500);
        await tester.pumpAndSettle();
      }

      // Proceed to UPI
      await tester.tap(find.byKey(const Key('proceedToUpiButton')));
      await tester.pumpAndSettle();

      // UPI screen – submit proof (mock)
      final submitProof = find.byKey(const Key('submitProofButton'));
      if (submitProof.evaluate().isNotEmpty) {
        await tester.tap(submitProof);
        await tester.pumpAndSettle();
      }

      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
    });

    // -----------------------------------------------------------------------
    // 7. Rewards
    // -----------------------------------------------------------------------
    testWidgets('Step 7 – Rewards', (tester) async {
      await app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();

      // Navigate to profile → rewards
      await tester.tap(find.byKey(const Key('profileTab')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('rewardsLink')));
      await tester.pumpAndSettle();

      // Verify rewards screen loaded
      expect(find.byKey(const Key('backButton')), findsOneWidget);

      // Go back
      await tester.tap(find.byKey(const Key('backButton')));
      await tester.pumpAndSettle();
    });

    // -----------------------------------------------------------------------
    // 8. Profile editing
    // -----------------------------------------------------------------------
    testWidgets('Step 8 – Edit Profile', (tester) async {
      await app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('profileTab')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('editProfileLink')));
      await tester.pumpAndSettle();

      // Edit fields
      await tester.enterText(
        find.byKey(const Key('editFullNameField')),
        'Updated Name',
      );
      await tester.enterText(
        find.byKey(const Key('editEmailField')),
        'updated@example.com',
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('submitProfileButton')));
      await tester.pumpAndSettle();

      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
    });

    // -----------------------------------------------------------------------
    // 9. Support ticket
    // -----------------------------------------------------------------------
    testWidgets('Step 9 – Support Ticket', (tester) async {
      await app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('supportTab')));
      await tester.pumpAndSettle();

      // Fill ticket
      await tester.tap(find.byKey(const Key('issueTypeDropdown')));
      await tester.pumpAndSettle();
      // Select first dropdown item
      await tester.tap(find.text('Payment Issue').first);
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(const Key('ticketDescriptionField')),
        'Test support ticket from integration test',
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('raiseTicketButton')));
      await tester.pumpAndSettle();

      await tester.pump(const Duration(seconds: 2));
      await tester.pumpAndSettle();
    });

    // -----------------------------------------------------------------------
    // 10. Emergency SOS
    // -----------------------------------------------------------------------
    testWidgets('Step 10 – Emergency SOS', (tester) async {
      await app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('profileTab')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('emergencySosLink')));
      await tester.pumpAndSettle();

      // Verify SOS screen elements
      expect(find.byKey(const Key('sosTriggerButton')), findsOneWidget);
      expect(find.byKey(const Key('emergencyContact1')), findsOneWidget);

      // Cancel and go back
      await tester.tap(find.byKey(const Key('cancelSosButton')));
      await tester.pumpAndSettle();
    });

    // -----------------------------------------------------------------------
    // 11. Notifications
    // -----------------------------------------------------------------------
    testWidgets('Step 11 – Notifications', (tester) async {
      await app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();

      // Tap notification bell on dashboard
      await tester.tap(find.byKey(const Key('notificationBell')));
      await tester.pumpAndSettle();

      // Mark all read
      final markAllRead = find.byKey(const Key('markAllReadButton'));
      if (markAllRead.evaluate().isNotEmpty) {
        await tester.tap(markAllRead);
        await tester.pumpAndSettle();
      }

      // Go back
      await tester.pageBack();
      await tester.pumpAndSettle();
    });

    // -----------------------------------------------------------------------
    // 12. Logout
    // -----------------------------------------------------------------------
    testWidgets('Step 12 – Logout', (tester) async {
      await app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('profileTab')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('logoutButton')));
      await tester.pumpAndSettle();

      // Should be back at login screen
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('phoneInput')), findsOneWidget);
    });

    // -----------------------------------------------------------------------
    // 13. Full end-to-end chain (all steps in one test)
    // -----------------------------------------------------------------------
    testWidgets('Full Journey – All flows chained', (tester) async {
      await app.main();
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 4));
      await tester.pumpAndSettle();

      // --- Auth ---
      final acceptCheckbox = find.byKey(const Key('acceptCheckbox'));
      if (acceptCheckbox.evaluate().isNotEmpty) {
        await tester.tap(acceptCheckbox);
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('continueLegalButton')));
        await tester.pumpAndSettle();
      }

      final permContinue = find.byKey(const Key('continuePermissionsButton'));
      if (permContinue.evaluate().isNotEmpty) {
        await tester.tap(permContinue);
        await tester.pumpAndSettle();
      }

      await waitFor(tester, find.byKey(const Key('phoneInput')));
      await tester.enterText(
        find.byKey(const Key('phoneInput')),
        testPhone,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('sendOtpButton')));
      await tester.pumpAndSettle();

      await waitFor(tester, find.byKey(const Key('otpInput')));
      await tester.enterText(
        find.byKey(const Key('otpInput')),
        testOtp,
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('verifyOtpButton')));
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();

      // --- Onboarding (if shown) ---
      final intentCard = find.text('Deliver with Us');
      if (intentCard.evaluate().isNotEmpty) {
        await tester.tap(intentCard);
        await tester.pumpAndSettle();
        await tester.tap(find.text('Confirm Selection'));
        await tester.pumpAndSettle();
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
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('nextOnboardingButton')));
        await tester.pumpAndSettle();
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
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('completeOnboardingButton')));
        await tester.pumpAndSettle();
      }

      // --- Plan (if shown) ---
      final planCard = find.byKey(const Key('planCard'));
      if (planCard.evaluate().isNotEmpty) {
        await tester.tap(planCard.first);
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('confirmPlanButton')));
        await tester.pumpAndSettle();
      }

      // --- Pickup (if shown) ---
      final hubCard = find.byKey(const Key('hubCard'));
      if (hubCard.evaluate().isNotEmpty) {
        await tester.tap(hubCard.first);
        await tester.pumpAndSettle();
        await tester.tap(find.byKey(const Key('confirmHubButton')));
        await tester.pumpAndSettle();
      }

      // --- Dashboard verification ---
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('dashboardTab')), findsOneWidget);

      // --- Wallet ---
      await tester.tap(find.byKey(const Key('walletTab')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('topUpButton')), findsOneWidget);

      // --- Profile ---
      await tester.tap(find.byKey(const Key('profileTab')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('editProfileLink')), findsOneWidget);
      expect(find.byKey(const Key('logoutButton')), findsOneWidget);

      // --- Support ---
      await tester.tap(find.byKey(const Key('supportTab')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('raiseTicketButton')), findsOneWidget);

      // --- Back to dashboard ---
      await tester.tap(find.byKey(const Key('dashboardTab')));
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('notificationBell')), findsOneWidget);

      // --- Logout ---
      await tester.tap(find.byKey(const Key('profileTab')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('logoutButton')));
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();

      // Verify back at login
      expect(find.byKey(const Key('phoneInput')), findsOneWidget);

      print('✅ Full journey completed successfully!');
    });
  });
}
