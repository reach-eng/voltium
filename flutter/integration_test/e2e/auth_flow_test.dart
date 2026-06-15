// integration_test/e2e/auth_flow_test.dart
//
// Voltium – Authentication E2E tests.
// Covers: splash, legal, permissions, login, OTP, auth choice, logout.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:voltium_rider/main.dart' as app;
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Auth Flow E2E', () {
    setUp(() async {
      await resetAppState();
    });

    testWidgets('Splash screen displays and auto-navigates', (tester) async {
      await safeAppMain();
      await tester.pump();

      // Splash should show Voltium branding
      expect(find.text('Voltium'), findsOneWidget);

      // After splash duration, should navigate to next screen
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      // Should be on permissions or login screen
      final possibleScreens = [
        find.byKey(const Key('continuePermissionsButton')),
        find.byKey(const Key('phoneInput')),
      ];

      bool foundScreen = false;
      for (final finder in possibleScreens) {
        if (finder.evaluate().isNotEmpty) {
          foundScreen = true;
          break;
        }
      }
      expect(foundScreen, isTrue,
          reason: 'No expected post-splash screen found');
    });

    testWidgets('Legal screen – accept terms and continue', (tester) async {
      await safeAppMain();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      final checkbox = find.byKey(const Key('acceptCheckbox'));
      if (checkbox.evaluate().isEmpty) {
        // Legal screen not shown (already accepted), skip
        return;
      }

      // Checkbox should be unchecked initially
      await tester.tap(checkbox);
      await settle(tester);

      // Continue button should be enabled
      final continueBtn = find.byKey(const Key('continueLegalButton'));
      expect(continueBtn, findsOneWidget);
      await tester.tap(continueBtn);
      await settle(tester);
    });

    testWidgets('Permissions screen – grant and continue', (tester) async {
      await safeAppMain();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      await completeLegalScreen(tester);

      final continueBtn = find.byKey(const Key('continuePermissionsButton'));
      if (continueBtn.evaluate().isEmpty) {
        return; // Permissions screen not shown
      }

      // Tap allow buttons for each permission
      final permissionButtons = [
        find.byKey(const Key('allowLocationButton')),
        find.byKey(const Key('allowContactsButton')),
        find.byKey(const Key('allowCameraButton')),
        find.byKey(const Key('allowNotificationsButton')),
      ];

      for (final btn in permissionButtons) {
        if (btn.evaluate().isNotEmpty) {
          await tester.tap(btn);
          await settle(tester);
        }
      }

      // Continue
      await tester.tap(continueBtn);
      await settle(tester);
    });

    testWidgets('Login screen – enter phone and send OTP', (tester) async {
      await safeAppMain();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      await completeLegalScreen(tester);
      await completePermissionsScreen(tester);
      await completeAuthChoiceScreen(tester);

      // Wait for login screen
      await waitFor(tester, find.byKey(const Key('phoneInput')));

      // Phone input should be visible
      expect(find.byKey(const Key('phoneInput')), findsOneWidget);
      expect(find.byKey(const Key('sendOtpButton')), findsOneWidget);

      // Enter valid phone number
      await tester.enterText(
        find.byKey(const Key('phoneInput')),
        TestCredentials.phone,
      );
      await settle(tester);

      // Tap send OTP
      await tester.ensureVisible(find.byKey(const Key('sendOtpButton')));
      await tester.tap(find.byKey(const Key('sendOtpButton')));
      await settle(tester);

      // Should navigate to OTP screen
      await waitFor(tester, find.byKey(const Key('otpInputRow')));
      expect(find.byKey(const Key('otpInputRow')), findsOneWidget);
    });

    testWidgets('OTP screen – enter code and verify', (tester) async {
      await safeAppMain();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      await completeLegalScreen(tester);
      await completePermissionsScreen(tester);
      await completeAuthChoiceScreen(tester);
      await completeAuthFlow(tester);

      // After OTP verification, should navigate to onboarding or dashboard
      await tester.pump(const Duration(seconds: 3));
      await settle(tester);

      // Either onboarding form or dashboard should be visible
      final onboardingForm = find.byKey(const Key('fullNameField'));
      final dashboard = find.byKey(const Key('dashboardTab'));

      expect(
        onboardingForm.evaluate().isNotEmpty || dashboard.evaluate().isNotEmpty,
        isTrue,
        reason: 'Should be on onboarding or dashboard after OTP verification',
      );
    });

    testWidgets('OTP screen – resend code button visible', (tester) async {
      await safeAppMain();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      await completeLegalScreen(tester);
      await completePermissionsScreen(tester);
      await completeAuthChoiceScreen(tester);

      await waitFor(tester, find.byKey(const Key('phoneInput')));
      await tester.enterText(
        find.byKey(const Key('phoneInput')),
        TestCredentials.phone,
      );
      await settle(tester);
      await tester.ensureVisible(find.byKey(const Key('sendOtpButton')));
      await tester.tap(find.byKey(const Key('sendOtpButton')));
      await settle(tester);

      await waitFor(tester, find.byKey(const Key('otpInputRow')));

      // Resend button should be visible
      expect(find.byKey(const Key('resendCodeButton')), findsOneWidget);
    });

    testWidgets('Full auth + onboarding → dashboard', (tester) async {
      final reachedDashboard = await fullLoginFlow(tester);
      expect(reachedDashboard, isTrue,
          reason: 'Should reach dashboard after full auth flow');
    });

    testWidgets('Logout returns to login screen', (tester) async {
      await fullLoginFlow(tester);

      // Navigate to profile
      await navigateToTab(tester, 'profileTab');

      // Tap logout
      final logoutBtn = find.byKey(const Key('logoutButton'));
      await tester.ensureVisible(logoutBtn);
      await tester.tap(logoutBtn);
      await settle(tester);
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);

      // Should be back at auth choice
      expectOnAuthChoice(tester);
    });

    testWidgets('Auth choice screen – create account button', (tester) async {
      await safeAppMain();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      final createAccountBtn = find.byKey(const Key('createAccountButton'));
      if (createAccountBtn.evaluate().isEmpty) {
        return; // Auth choice not shown
      }

      expect(createAccountBtn, findsOneWidget);
      await tester.tap(createAccountBtn);
      await settle(tester);

      // Should navigate to legal screen
      expect(find.byKey(const Key('acceptCheckbox')), findsOneWidget);
    });

    testWidgets('Auth choice screen – login with phone button', (tester) async {
      await safeAppMain();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      final loginBtn = find.byKey(const Key('loginWithPhoneButton'));
      if (loginBtn.evaluate().isEmpty) {
        return;
      }

      expect(loginBtn, findsOneWidget);
      await tester.tap(loginBtn);
      await settle(tester);

      // Should navigate to login screen
      expect(find.byKey(const Key('phoneInput')), findsOneWidget);
    });
  });
}
