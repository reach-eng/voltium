// integration_test/e2e_individual/41_realtime_onboarding_to_active_dashboard_test.dart
//
// Standalone test: Watch a fresh user launch the app, step through permissions/terms,
// log in, and arrive at the premium Active Dashboard in real time.
//
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/41_realtime_onboarding_to_active_dashboard_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets(
      'Realtime Full Journey – Splash → Legal/Permissions → Login → Active Dashboard',
      (tester) async {
    print('🚀 [Voltium Realtime Test] Starting fresh run from 0...');

    // 1. Start from a completely clean slate
    await resetAppState();
    await safeAppMain();
    await settle(tester);

    print('👀 [Voltium Realtime Test] Displaying Splash Screen (3s pause)...');
    await tester.pump(const Duration(seconds: 3));
    await settle(tester);

    // 2. Handle Preamble Screens with delays so the user can watch the UI step-by-step
    print(
        '🔄 [Voltium Realtime Test] Processing onboarding preamble screens...',);

    for (int i = 0; i < 5; i++) {
      await settle(tester);

      // Check if we reached Dashboard
      if (find.byKey(const Key('dashboardTab')).evaluate().isNotEmpty) {
        print('🎉 [Voltium Realtime Test] Dashboard found directly!');
        break;
      }

      // Check if we reached Login Screen
      if (find.byKey(const Key('phoneInput')).evaluate().isNotEmpty) {
        print('📱 [Voltium Realtime Test] Arrived at Phone Login Screen!');
        break;
      }

      // Check if Legal Screen is visible
      final legalCheckbox = find.byKey(const Key('acceptCheckbox'));
      if (legalCheckbox.evaluate().isNotEmpty) {
        print(
            '📜 [Voltium Realtime Test] Arrived at Legal screen. Accepting terms...',);
        await tester.tap(legalCheckbox);
        await settle(tester);
        await tester.pump(const Duration(seconds: 1));

        await tester.tap(find.byKey(const Key('continueLegalButton')));
        await settle(tester);
        print(
            '📜 [Voltium Realtime Test] Accepted terms and conditions. Moving to next screen...',);
        await tester.pump(const Duration(seconds: 2));
        continue;
      }

      // Check if Permissions Screen is visible
      final continuePermissions =
          find.byKey(const Key('continuePermissionsButton'));
      if (continuePermissions.evaluate().isNotEmpty) {
        print(
            '🛡️ [Voltium Realtime Test] Arrived at Permissions screen. Enabling mock permissions...',);

        // Opt-in toggles if available
        final allowButtons = [
          find.byKey(const Key('allowLocationButton')),
          find.byKey(const Key('allowContactsButton')),
          find.byKey(const Key('allowCameraButton')),
          find.byKey(const Key('allowNotificationsButton')),
        ];
        for (final btn in allowButtons) {
          if (btn.evaluate().isNotEmpty) {
            await tester.tap(btn);
            await settle(tester);
            await tester.pump(const Duration(milliseconds: 500));
          }
        }

        print(
            '👉 [Voltium Realtime Test] Tapping Continue on Permissions Screen...',);
        await tester.tap(continuePermissions);
        await settle(tester);
        await tester.pump(const Duration(seconds: 2));
        continue;
      }

      // Check if Auth Choice Screen is visible
      final loginWithPhone = find.byKey(const Key('loginWithPhoneButton'));
      if (loginWithPhone.evaluate().isNotEmpty) {
        print(
            '📱 [Voltium Realtime Test] Arrived at Auth Choice screen. Tapping Login with Phone...',);
        await tester.tap(loginWithPhone);
        await settle(tester);
        await tester.pump(const Duration(seconds: 2));
        continue;
      }

      // Safe fallback wait
      print('⏳ [Voltium Realtime Test] Waiting for transition...');
      await tester.pump(const Duration(seconds: 1));
    }

    // 3. Login Flow
    await settle(tester);
    if (find.byKey(const Key('phoneInput')).evaluate().isNotEmpty) {
      print('✍️ [Voltium Realtime Test] Typing phone number...');
      await tester.enterText(
          find.byKey(const Key('phoneInput')), TestCredentials.phone,);
      await settle(tester);
      await tester.pump(const Duration(seconds: 2));

      print('👉 [Voltium Realtime Test] Tapping Send OTP...');
      final sendOtpBtn = find.byKey(const Key('sendOtpButton'));
      final loginScrollable = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(sendOtpBtn, 200,
          scrollable: loginScrollable,);
      await settle(tester);
      await tester.tap(sendOtpBtn);
      await settle(tester);
      await tester.pump(const Duration(seconds: 2));
    }

    // 4. OTP Verification Flow
    await settle(tester);
    final otpInputRow = find.byKey(const Key('otpInputRow'));
    if (otpInputRow.evaluate().isNotEmpty) {
      print(
          '🔐 [Voltium Realtime Test] Arrived at OTP Screen. Entering 6-digit OTP code...',);
      final otpFields = find.descendant(
        of: otpInputRow,
        matching: find.byType(TextField),
      );

      for (int i = 0; i < 6; i++) {
        await tester.enterText(otpFields.at(i), TestCredentials.otp[i]);
        await tester.pump(const Duration(milliseconds: 300));
      }
      await settle(tester);
      await tester.pump(const Duration(seconds: 2));

      print('👉 [Voltium Realtime Test] Tapping Verify OTP...');
      final verifyOtpBtn = find.byKey(const Key('verifyOtpButton'));
      final otpScrollable = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(verifyOtpBtn, 200,
          scrollable: otpScrollable,);
      await settle(tester);
      await tester.tap(verifyOtpBtn);
      await settle(tester);
      print(
          '🔄 [Voltium Realtime Test] Verification submitted. Navigating to Dashboard...',);
      await tester.pump(const Duration(seconds: 3));
      await settle(tester);
    }

    // 5. Active Dashboard Verification
    await settle(tester);
    print('🎉 [Voltium Realtime Test] Arrived at the Active Dashboard!');
    expect(find.byKey(const Key('dashboardTab')), findsOneWidget);
    expect(find.byKey(const Key('notificationBell')), findsOneWidget);

    print(
        '✨ [Voltium Realtime Test] Holding view on Active Dashboard for 10 seconds to allow live realtime observation! enjoy! ✨',);
    await tester.pump(const Duration(seconds: 10));
    await settle(tester);

    print(
        '✅ [Voltium Realtime Test] Realtime observation complete. Test successful!',);
  });
}
