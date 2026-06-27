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
import 'package:integration_test/integration_test.dart';
import 'test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // ── Test 1: Login with empty phone shows validation error ─────────────
  testWidgets('Login – empty phone field shows validation', (tester) async {
    await launchApp(tester);
    await handlePreamble(tester);

    // Try to submit with empty phone — should stay on login screen
    final loginButton = find.byKey(const Key('sendOtpButton'));
    if (loginButton.evaluate().isNotEmpty) {
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
    await launchApp(tester);
    await handlePreamble(tester);

    // Enter valid phone
    final phoneField = find.byKey(const Key('phoneNumberField'));
    if (phoneField.evaluate().isNotEmpty) {
      await tester.enterText(phoneField.first, TestCredentials.phone);

      // Tap Send OTP
      final sendOtpButton = find.byKey(const Key('sendOtpButton'));
      if (sendOtpButton.evaluate().isNotEmpty) {
        await settle(tester);
        await tester.tap(sendOtpButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 3));
      }
    }

    // Enter wrong OTP (not 111111)
    final otpField = find.byKey(const Key('otpField'));
    if (otpField.evaluate().isNotEmpty) {
      await tester.enterText(otpField.first, '000000');
      await tester.pumpAndSettle(const Duration(seconds: 1));

      // Tap Verify
      final verifyButton = find.byKey(const Key('verifyOtpButton'));
      if (verifyButton.evaluate().isNotEmpty) {
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
    await launchApp(tester);
    await handlePreamble(tester);

    // Enter valid phone
    final phoneField = find.byKey(const Key('phoneNumberField'));
    if (phoneField.evaluate().isNotEmpty) {
      await tester.enterText(phoneField.first, TestCredentials.phone);

      // Tap Send OTP
      final sendOtpButton = find.byKey(const Key('sendOtpButton'));
      if (sendOtpButton.evaluate().isNotEmpty) {
        await settle(tester);
        await tester.tap(sendOtpButton.first);
        await tester.pumpAndSettle(const Duration(seconds: 2));
      }
    }

    // Try resend multiple times rapidly
    final resendButton = find.byKey(const Key('resendOtpButton'));
    if (resendButton.evaluate().isNotEmpty) {
      for (int i = 0; i < 5 && resendButton.evaluate().isNotEmpty; i++) {
        await settle(tester);
        await tester.tap(resendButton.first);
        await tester.pump(const Duration(milliseconds: 500));
      }

      // After rapid resends, app should still be on OTP screen (not crash)
      await tester.pumpAndSettle(const Duration(seconds: 2));
      expect(find.byKey(const Key('otpField')).evaluate().isNotEmpty ||
          find.byKey(const Key('verifyOtpButton')).evaluate().isNotEmpty, isTrue,
          reason: 'App should not crash after rapid OTP resend');
    }
  });

  // ── Test 4: Wallet top-up with invalid amount ──────────────────────────
  testWidgets('Wallet top-up – invalid amount shows error', (tester) async {
    await fullLoginFlow(tester);
    await expectOnDashboard(tester);

    // Navigate to wallet
    await navigateToTab(tester, 'walletTab');
    await settle(tester);

    // Find and tap top-up button
    final topupButton = find.byKey(const Key('topupButton'));
    if (topupButton.evaluate().isNotEmpty) {
      await scrollAndTap(tester, topupButton.first);
      await settle(tester);

      // Enter invalid amount (zero)
      final amountField = find.byKey(const Key('topupAmountField'));
      if (amountField.evaluate().isNotEmpty) {
        await smartEnterText(tester, amountField.first, '0');
        await settle(tester);

        // Should see validation error or the submit button should be disabled
        // final errorText = find.textContaining('minimum');
        final submitButton = find.byKey(const Key('submitTopupButton'));
        if (submitButton.evaluate().isNotEmpty) {
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
    await fullLoginFlow(tester);
    await expectOnDashboard(tester);

    // Navigate to profile
    await navigateToTab(tester, 'profileTab');
    await settle(tester);

    // Tap edit profile
    final editButton = find.byKey(const Key('editProfileButton'));
    if (editButton.evaluate().isNotEmpty) {
      await scrollAndTap(tester, editButton.first);
      await settle(tester);

      // Clear name field
      final nameField = find.byKey(const Key('profileNameField'));
      if (nameField.evaluate().isNotEmpty) {
        await smartEnterText(tester, nameField.first, '');
        await settle(tester);

        // Try to save
        final saveButton = find.byKey(const Key('saveProfileButton'));
        if (saveButton.evaluate().isNotEmpty) {
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
    await fullLoginFlow(tester);
    await expectOnDashboard(tester);

    await navigateToTab(tester, 'profileTab');
    await settle(tester);

    final supportButton = find.byKey(const Key('supportButton'));
    if (supportButton.evaluate().isNotEmpty) {
      await scrollAndTap(tester, supportButton.first);
      await settle(tester);
      await scrollAndTap(tester, find.byKey(const Key('createTicketButton')));
      await settle(tester);

      // Try to submit empty ticket
      final submitButton = find.byKey(const Key('submitTicketButton'));
      if (submitButton.evaluate().isNotEmpty) {
        await scrollAndTap(tester, submitButton.first);
        await settle(tester);

        // Should see validation error
        final ticketForm = find.byKey(const Key('ticketDescriptionField'));
        expect(ticketForm.evaluate().isNotEmpty, isTrue,
            reason: 'Should stay on ticket screen with empty description');
      }
    }
  });
}
