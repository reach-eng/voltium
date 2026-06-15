// integration_test/comprehensive_e2e_test.dart
//
// Voltium – Robust end-to-end integration test for the Android client.
// This test uses descriptive logging and robust waits to handle animations.

import 'package:flutter_test/flutter_test.dart';
import 'helpers/test_helpers.dart';
import 'package:integration_test/integration_test.dart';
import 'package:flutter/material.dart';
import 'package:voltium_rider/main.dart' as app;

void main() {
  final binding = IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Voltium Comprehensive E2E', () {
    final testPhone =
        '900${DateTime.now().millisecondsSinceEpoch.toString().substring(6)}';
    const testOtp = '111111';

    // Helper to log progress
    void log(String message) {
      print('[E2E-LOG] $message');
    }

    // Helper to wait and pump
    Future<void> settle(WidgetTester tester, {Duration? duration}) async {
      if (duration != null) {
        await tester.pump(duration);
      }
      // pumpAndSettle can hang with infinite animations (like our bouncing icons)
      // We'll pump a few times to let transitions finish
      for (int i = 0; i < 20; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
    }

    testWidgets(
        'Full User Journey: Auth -> Onboarding -> Dashboard -> Wallet -> Logout',
        (tester) async {
      log('Starting Application...');
      await app.main();
      await settle(tester);

      // --- 1. Splash Screen / Auth Choice ---
      log('Waiting for Splash or Choice Screen...');
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      // Handle Auth Choice if it appears
      final createAccountBtn = find.byKey(const Key('createAccountButton'));
      if (createAccountBtn.evaluate().isNotEmpty) {
        log('Tapping Create Account on Choice Screen');
        await tester.tap(createAccountBtn);
        await settle(tester);
      }

      // --- 2. Legal Screen ---
      log('Checking for Legal Screen...');
      final acceptCheckbox = find.byKey(const Key('acceptCheckbox'));
      if (acceptCheckbox.evaluate().isNotEmpty) {
        log('Tapping Accept Checkbox');
        await tester.tap(acceptCheckbox);
        await settle(tester);

        log('Tapping Continue');
        await tester.tap(find.byKey(const Key('continueLegalButton')));
        await settle(tester);
      }

      // --- 3. Permissions Screen ---
      log('Checking for Permissions Screen...');
      final permContinue = find.byKey(const Key('continuePermissionsButton'));
      if (permContinue.evaluate().isNotEmpty) {
        log('Granting Required Permissions...');

        // Tap Allow for required ones
        final requiredKeys = ['allowLocationButton', 'allowContactsButton'];

        for (final keyStr in requiredKeys) {
          final btn = find.byKey(Key(keyStr));
          if (btn.evaluate().isNotEmpty) {
            // Check if it already says "Allowed"
            final allowedText = find.descendant(
              of: btn,
              matching: find.text('Allowed'),
            );
            final allowText = find.descendant(
              of: btn,
              matching: find.text('Allow'),
            );

            if (allowText.evaluate().isNotEmpty) {
              log('Tapping $keyStr');
              await tester.tap(btn);
              await tester.pump(const Duration(milliseconds: 500));
            } else {
              log('$keyStr already granted');
            }
          }
        }

        await settle(tester);

        log('Waiting for CONTINUE button to be enabled...');
        bool enabled = false;
        for (int i = 0; i < 20; i++) {
          if (find.text('CONTINUE').evaluate().isNotEmpty) {
            enabled = true;
            break;
          }
          await tester.pump(const Duration(milliseconds: 500));
        }

        if (!enabled) {
          log('⚠️ CONTINUE button never enabled, attempting tap anyway...');
        }

        log('Tapping Permissions Continue');
        await tester.tap(permContinue);
        await settle(tester);
      }

      // --- 4. Login Screen ---
      log('Entering Phone Number...');
      await tester.enterText(find.byKey(const Key('phoneInput')), testPhone);
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await settle(tester);

      final sendOtpBtn = find.byKey(const Key('sendOtpButton'));
      if (sendOtpBtn.evaluate().isNotEmpty) {
        log('Tapping Send OTP');
        await tester.tap(sendOtpBtn);
        await settle(tester);
      } else {
        log('Send OTP button not found - likely already submitted via keyboard');
      }

      // --- 5. OTP Screen ---
      log('Entering OTP...');
      await settle(tester);

      // Explicitly wait for OTP fields to appear
      int retry = 0;
      while (find.byKey(const Key('otpInputRow')).evaluate().isEmpty &&
          retry < 10) {
        log('Waiting for OTP row (retry $retry)...');
        await settle(tester, duration: const Duration(milliseconds: 500));
        retry++;
      }

      for (int i = 0; i < testOtp.length; i++) {
        final digit = testOtp[i];
        final otpField = find
            .descendant(
              of: find.byKey(const Key('otpInputRow')),
              matching: find.byType(TextField),
            )
            .at(i);
        await tester.enterText(otpField, digit);
        await tester.pump(const Duration(milliseconds: 100));
      }
      await settle(tester);

      log('Tapping Verify OTP');
      await tester.tap(find.byKey(const Key('verifyOtpButton')));
      await settle(tester);
      await settle(tester, duration: const Duration(seconds: 2));

      // --- 6. Onboarding (Intent) ---
      log('Checking for Onboarding (Intent)...');
      // Wait for Intent screen
      retry = 0;
      while (find.byKey(const ValueKey('intent')).evaluate().isEmpty &&
          retry < 5) {
        await settle(tester, duration: const Duration(milliseconds: 500));
        retry++;
      }

      final intentCard = find.byKey(const Key('deliverWithUsCard'));
      if (intentCard.evaluate().isNotEmpty) {
        log('Selecting "Deliver with Us"');
        await tester.tap(intentCard);
        await settle(tester);

        log('Confirming Selection');
        await tester.tap(find.byKey(const Key('confirmIntentButton')));
        await settle(tester);
      }

      // --- 7. Onboarding (User Info) ---
      log('Checking for User Onboarding...');
      // Wait for Onboarding screen
      retry = 0;
      while (find.byKey(const ValueKey('userForm')).evaluate().isEmpty &&
          retry < 5) {
        await settle(tester, duration: const Duration(milliseconds: 500));
        retry++;
      }

      final userOnboardingTitle = find.byKey(const ValueKey('userForm'));
      if (userOnboardingTitle.evaluate().isNotEmpty) {
        log('Filling User Information');
        await tester.enterText(
            find.byKey(const Key('fullNameField')), 'E2E Tester');
        await tester.enterText(
            find.byKey(const Key('emailField')), 'e2e@voltfleet.com');
        await tester.enterText(
            find.byKey(const Key('fatherNameField')), 'Father Name');
        await tester.enterText(
            find.byKey(const Key('motherNameField')), 'Mother Name');
        await settle(tester);

        log('Tapping Next');
        await tester.tap(find.byKey(const Key('nextOnboardingButton')));
        await settle(tester);
      }

      // --- 8. Onboarding (Guarantor) ---
      log('Checking for Guarantor Onboarding...');
      // It might be behind a PreDashboardScreen action button
      retry = 0;
      while (find.byKey(const ValueKey('preDashboard')).evaluate().isNotEmpty &&
          retry < 8) {
        log('On PreDashboard, tapping action button...');
        final actionBtn = find.byKey(const Key('preDashboardActionButton'));

        if (actionBtn.evaluate().isNotEmpty) {
          try {
            await tester.ensureVisible(actionBtn);
            await tester.tap(actionBtn);
            await settle(tester);
          } catch (e) {
            log('Tap on action button failed, retrying: $e');
            await settle(tester, duration: const Duration(milliseconds: 500));
          }
        } else {
          log('Action button not found on PreDashboard, waiting...');
          await settle(tester, duration: const Duration(milliseconds: 500));
        }
        retry++;
      }

      // Wait for Guarantor screen
      retry = 0;
      while (find.byKey(const ValueKey('guarantorForm')).evaluate().isEmpty &&
          retry < 15) {
        await settle(tester, duration: const Duration(milliseconds: 500));
        retry++;
      }

      final guarantorTitle = find.byKey(const ValueKey('guarantorForm'));
      if (guarantorTitle.evaluate().isNotEmpty) {
        log('Filling Guarantor Information');
        await tester.enterText(
            find.byKey(const Key('guarantorNameField')), 'Jane Doe');
        await tester.enterText(
            find.byKey(const Key('guarantorPhoneField')), '9888777666');
        await settle(tester);

        log('Selecting Relationship');
        await tester.tap(find.byKey(const Key('relationshipDropdown')));
        await settle(tester);
        await tester.tap(find.text('Father').last);
        await settle(tester);

        log('Completing Onboarding');
        await tester.tap(find.byKey(const Key('completeOnboardingButton')));
        await settle(tester);
      }

      // --- 9. Dashboard ---
      log('Verifying Dashboard...');
      // Might need to pass through PreDashboard again if not automatically navigated
      retry = 0;
      while (find.byKey(const ValueKey('preDashboard')).evaluate().isNotEmpty &&
          retry < 12) {
        log('On PreDashboard, waiting or tapping action button to reach Dashboard...');
        final actionBtn = find.byKey(const Key('preDashboardActionButton'));

        if (actionBtn.evaluate().isNotEmpty) {
          try {
            final btnText = (tester.widget(find.descendant(
                    of: actionBtn, matching: find.byType(Text))) as Text)
                .data;
            if (btnText == 'Book Vehicle' || btnText == 'Start Ride') {
              log('Reached final step on PreDashboard: $btnText. Waiting for shell transition...');
              await settle(tester, duration: const Duration(seconds: 1));
            } else {
              log('Tapping action button on PreDashboard: $btnText');
              await tester.ensureVisible(actionBtn);
              await tester.tap(actionBtn);
              await settle(tester);
            }
          } catch (e) {
            log('Interaction on PreDashboard failed, retrying: $e');
            await settle(tester, duration: const Duration(milliseconds: 500));
          }
        } else {
          log('PreDashboard visible but action button not found, waiting...');
          await settle(tester, duration: const Duration(milliseconds: 500));
        }
        retry++;
      }

      // Wait for Dashboard screen
      retry = 0;
      while (find.byKey(const ValueKey('dashboard')).evaluate().isEmpty &&
          retry < 30) {
        log('Waiting for Dashboard (retry $retry)...');
        await settle(tester, duration: const Duration(milliseconds: 500));
        retry++;
      }
      expect(find.byKey(const Key('dashboardTab')), findsOneWidget);
      expect(find.byKey(const Key('notificationBell')), findsOneWidget);

      // --- 10. Wallet ---
      log('Navigating to Wallet...');
      await tester.tap(find.byKey(const Key('walletTab')));
      await settle(tester);

      log('Verifying Wallet Elements...');
      expect(find.byKey(const Key('topUpButton')), findsOneWidget);
      expect(find.byKey(const Key('historyButton')), findsOneWidget);

      // --- 11. Profile ---
      log('Navigating to Profile...');
      await tester.tap(find.byKey(const Key('profileTab')));
      await settle(tester);

      log('Verifying Profile Elements...');
      expect(find.byKey(const Key('logoutButton')), findsOneWidget);
      // Profile shows the name entered in onboarding
      expect(find.text('E2E Tester'), findsOneWidget);

      // --- 12. Logout ---
      log('Tapping Logout...');
      await tester.tap(find.byKey(const Key('logoutButton')));
      await settle(tester);
      await settle(tester, duration: const Duration(seconds: 2));

      log('Verifying back at Login Screen...');
      expect(find.byKey(const Key('phoneInput')), findsOneWidget);

      log('✅ E2E Test Completed Successfully!');
    });
  });
}
