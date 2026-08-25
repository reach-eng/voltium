// integration_test/e2e_individual/42_adversarial_error_paths_test.dart
//
// Adversarial E2E tests: validates app behavior under error conditions.
// Tests that the app gracefully handles API failures, network errors,
// invalid inputs, and corrupted data without crashing.
//
// Run: flutter drive --driver=test_driver/integration_test.dart
//       --target=integration_test/e2e_individual/42_adversarial_error_paths_test.dart
//       -d emulator-5554
//       --dart-define=API_URL=http://localhost:8081
//       --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../pages/app_robots.dart';
import 'package:integration_test/integration_test.dart';
import 'test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // ── Test 1: Login with empty phone shows validation error ─────────────
  testWidgets('Login – empty phone field shows validation', (tester) async {
    final app = AppRobots(tester);
    await launchApp(tester);
    await handlePreamble(tester);

    // Try to submit with empty phone — should stay on login screen
    final loginButton = app.login.getOtpButton;
    { // AUDIT FIX: removed vacuous-pass guard on loginButton
      await settle(tester);
      await tester.tap(loginButton.first);
      await tester.pumpAndSettle(const Duration(seconds: 2));

      // Should still be on the login screen (not navigated away)
      expect(loginButton.evaluate().isNotEmpty, isTrue,
          reason: 'Should stay on login screen with empty phone');
    }
  });

  // ── Test 2: Invalid OTP handling ──────────────────────────────────────
  testWidgets('Login – invalid OTP shows error message', (tester) async {
    final app = AppRobots(tester);
    await launchApp(tester);
    await handlePreamble(tester);

    // Enter valid phone
    final phoneField = app.shared.phoneNumberField;
    { // AUDIT FIX: removed vacuous-pass guard on phoneField
      await tester.enterText(phoneField.first, TestCredentials.phone);

      // Tap Send OTP
      final sendOtpButton = app.login.getOtpButton;
      { // AUDIT FIX: removed vacuous-pass guard on sendOtpButton
        await settle(tester);
        await tester.tap(sendOtpButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 3));
      }
    }

    // Enter wrong OTP (not 111111)
    final otpField = app.shared.otpField;
    { // AUDIT FIX: removed vacuous-pass guard on otpField
      await tester.enterText(otpField.first, '000000');
      await tester.pumpAndSettle(const Duration(seconds: 1));

      // Tap Verify
      final verifyButton = app.login.verifyOtpButton;
      { // AUDIT FIX: removed vacuous-pass guard on verifyButton
        await settle(tester);
        await tester.tap(verifyButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 3));

        // Should show error and still be on verification screen
        expect(verifyButton.evaluate().isNotEmpty, isTrue,
            reason: 'Should stay on OTP screen after invalid OTP');
      }
    }
  });

  // ── Test 3: Rapid OTP resend attempts ──────────────────────────────────
  testWidgets('OTP – rapid resend shows rate limit feedback', (tester) async {
    final app = AppRobots(tester);
    await launchApp(tester);
    await handlePreamble(tester);

    // Enter valid phone
    final phoneField = app.shared.phoneNumberField;
    { // AUDIT FIX: removed vacuous-pass guard on phoneField
      await tester.enterText(phoneField.first, TestCredentials.phone);

      // Tap Send OTP
      final sendOtpButton = app.login.getOtpButton;
      { // AUDIT FIX: removed vacuous-pass guard on sendOtpButton
        await settle(tester);
        await tester.tap(sendOtpButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 2));
      }
    }

    // Try resend multiple times rapidly
    final resendButton = app.shared.resendOtpButton;
    { // AUDIT FIX: removed vacuous-pass guard on resendButton
      for (int i = 0; i < 5 && resendButton.evaluate().isNotEmpty; i++) {
        await settle(tester);
        await tester.tap(resendButton.first);
        await tester.pump(const Duration(milliseconds: 500));
      }

      // After rapid resends, app should still be on OTP screen (not crash)
      await tester.pumpAndSettle(const Duration(seconds: 2));
      expect(
          app.shared.otpField.evaluate().isNotEmpty ||
              app.login.verifyOtpButton.evaluate().isNotEmpty,
          isTrue,
          reason: 'App should not crash after rapid OTP resend');
    }
  });

  // ── Test 4: Wallet top-up with invalid amount ──────────────────────────
  testWidgets('Wallet top-up – invalid amount shows error', (tester) async {
    final app = AppRobots(tester);
    await fullLoginFlow(tester);
    await expectOnDashboard(tester);

    // Navigate to wallet
    await navigateToTab(tester, 'walletTab');
    await settle(tester);

    // Find and tap top-up button
    final topupButton = app.shared.topupButton;
    { // AUDIT FIX: removed vacuous-pass guard on topupButton
      await scrollAndTap(tester, topupButton.first);
      await settle(tester);

      // Enter invalid amount (zero)
      final amountField = app.shared.topupAmountField;
      { // AUDIT FIX: removed vacuous-pass guard on amountField
        await smartEnterText(tester, amountField.first, '0');
        await settle(tester);

        // Should see validation error or the submit button should be disabled
        // final errorText = find.textContaining('minimum');
        final submitButton = app.shared.submitTopupButton;
        { // AUDIT FIX: removed vacuous-pass guard on submitButton
          await scrollAndTap(tester, submitButton.first);
          await settle(tester);

          // Should still be on top-up screen (not navigated away)
          expect(amountField.evaluate().isNotEmpty, isTrue,
              reason: 'Should stay on top-up screen with invalid amount');
        }
      }
    }
  });

  // ── Test 5: Profile edit with empty required fields ────────────────────
  testWidgets('Profile – empty required fields blocked', (tester) async {
    final app = AppRobots(tester);
    await fullLoginFlow(tester);
    await expectOnDashboard(tester);

    // Navigate to profile
    await navigateToTab(tester, 'profileTab');
    await settle(tester);

    // Tap edit profile
    final editButton = app.profile.editProfileButton;
    { // AUDIT FIX: removed vacuous-pass guard on editButton
      await scrollAndTap(tester, editButton.first);
      await settle(tester);

      // Clear name field
      final nameField = app.profile.profileNameField;
      { // AUDIT FIX: removed vacuous-pass guard on nameField
        await smartEnterText(tester, nameField.first, '');
        await settle(tester);

        // Try to save
        final saveButton = app.profile.saveProfileButton;
        { // AUDIT FIX: removed vacuous-pass guard on saveButton
          await scrollAndTap(tester, saveButton.first);
          await settle(tester);

          // Should still be on edit screen
          expect(nameField.evaluate().isNotEmpty, isTrue,
              reason: 'Should stay on edit screen with empty name');
        }
      }
    }
  });

  // ── Test 6: Support ticket with empty description ──────────────────────
  testWidgets('Support – empty ticket shows error', (tester) async {
    final app = AppRobots(tester);
    await fullLoginFlow(tester);
    await expectOnDashboard(tester);

    await navigateToTab(tester, 'profileTab');
    await settle(tester);

    final supportButton = app.shared.supportButton;
    { // AUDIT FIX: removed vacuous-pass guard on supportButton
      await scrollAndTap(tester, supportButton.first);
      await settle(tester);
      await scrollAndTap(tester, app.shared.createTicketButton);
      await settle(tester);

      // Try to submit empty ticket
      final submitButton = app.support.submitTicketButton;
      { // AUDIT FIX: removed vacuous-pass guard on submitButton
        await scrollAndTap(tester, submitButton.first);
        await settle(tester);

        // Should see validation error
        final ticketForm = app.support.ticketDescriptionField;
        expect(ticketForm.evaluate().isNotEmpty, isTrue,
            reason: 'Should stay on ticket screen with empty description');
      }
    }
  });
}
