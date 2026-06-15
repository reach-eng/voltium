// integration_test/helpers/test_helpers.dart
//
// Voltium – Shared E2E test utilities and helpers.
// Provides: wait helpers, auth flow helpers, navigation helpers, form fillers.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/main.dart' as app;
import 'package:voltium_rider/services/api_service.dart';
import 'package:voltium_rider/services/cache_service.dart';

/// Wraps app.main() to save/restore FlutterError.onError.
/// Required because main.dart overrides FlutterError.onError which conflicts
/// with the test framework's error handling.
Future<void> safeAppMain() async {
  final originalErrorHandler = FlutterError.onError;
  await app.main();
  FlutterError.onError = originalErrorHandler;
}

/// Clear all app state (SharedPreferences, cache) to ensure clean test isolation.
Future<void> resetAppState() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.clear();
  // Re-initialize CacheService singleton with fresh prefs
  await CacheService().init();
  await CacheService().clearAll();
}

/// Set up app state to simulate a returning user (skips onboarding/legal loops).
Future<void> setupReturningUser() async {
  await resetAppState();
  // Pre-populate cache so auth_wrapper treats user as returning
  await CacheService().cacheRider({
    'id': 'test-rider-id',
    'name': 'Test Rider',
    'phone': TestCredentials.phone,
    'status': 'ACTIVE',
    'pickupDone': true,
  });
}

/// Standard test credentials (dev backend accepts any 10-digit phone)
class TestCredentials {
  static const String phone = '9876543210';
  static const String otp = '111111';
  static const String fullName = 'Test Rider';
  static const String email = 'test@example.com';
  static const String fatherName = 'Test Father';
  static const String motherName = 'Test Mother';
  static const String guarantorName = 'Test Guarantor';
  static const String guarantorPhone = '9998887776';
}

/// Wait for a widget to appear with configurable timeout.
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

/// Smart tap that handles multiple candidates by picking the last one (usually the top-most).
Future<void> smartTap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  if (finder.evaluate().length > 1) {
    await tester.tap(finder.last);
  } else {
    await tester.tap(finder);
  }
  await settle(tester);
}

/// Ensures a widget is visible (by scrolling if needed) and then taps it.
Future<void> scrollAndTap(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await smartTap(tester, finder);
}

/// Smart enterText that handles multiple candidates by picking the last one.
Future<void> smartEnterText(
    WidgetTester tester, Finder finder, String text) async {
  if (finder.evaluate().length > 1) {
    await tester.enterText(finder.last, text);
  } else {
    await tester.enterText(finder, text);
  }
  await settle(tester);
}

/// Wait for a widget to disappear.
Future<void> waitUntilGone(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 10),
}) async {
  final end = DateTime.now().add(timeout);
  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 500));
    if (finder.evaluate().isEmpty) return;
  }
  fail('Widget still present after ${timeout.inSeconds}s: $finder');
}

/// Smart settle that pumps until no loading indicators are visible.
/// Falls back to max pumps if loading indicators persist beyond timeout.
Future<void> settle(
  WidgetTester tester, {
  Duration timeout = const Duration(seconds: 5),
  int maxPumps = 100,
}) async {
  final end = DateTime.now().add(timeout);
  int pumps = 0;
  int stableCount = 0;
  const requiredStableFrames = 3;

  while (pumps < maxPumps && DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 100));
    pumps++;

    final hasLoading = find
        .byWidgetPredicate(
          (widget) =>
              widget is CircularProgressIndicator ||
              widget is LinearProgressIndicator,
        )
        .evaluate()
        .isNotEmpty;

    if (!hasLoading) {
      stableCount++;
      if (stableCount >= requiredStableFrames) return;
    } else {
      stableCount = 0;
    }
  }
}

/// Waits for route transitions to complete by detecting Navigator animations.
Future<void> waitForTransition(
  WidgetTester tester, {
  Duration timeout = const Duration(seconds: 5),
}) async {
  final end = DateTime.now().add(timeout);
  int stableCount = 0;
  const requiredStableFrames = 3;

  while (DateTime.now().isBefore(end)) {
    await tester.pump(const Duration(milliseconds: 50));

    final hasTransition = find
        .byWidgetPredicate(
          (widget) =>
              widget is ModalBarrier ||
              (widget is AnimatedWidget &&
                  widget.toString().contains('Transition')),
        )
        .evaluate()
        .isNotEmpty;

    if (!hasTransition) {
      stableCount++;
      if (stableCount >= requiredStableFrames) return;
    } else {
      stableCount = 0;
    }
  }
}

/// Launch the app and wait for it to settle past splash.
/// Clears cached auth state to ensure splash screen is shown.
Future<void> launchApp(WidgetTester tester) async {
  await resetAppState();
  await safeAppMain();
  await settle(tester);
  // Splash screen shows for ~3 seconds
  await tester.pump(const Duration(seconds: 4));
  await settle(tester);
}

/// Complete the legal/terms screen if shown.
/// Waits up to 5 seconds for the screen to appear.
/// Helper to handle any preamble screens (legal, permissions, auth choice) until we reach login or dashboard.
Future<void> handlePreamble(WidgetTester tester) async {
  print('--- Current Screen Check ---');
  for (int i = 0; i < 5; i++) {
    // Max 5 screens/transitions
    await settle(tester);

    // Check for Dashboard (already logged in)
    if (find.byKey(const Key('dashboardTab')).evaluate().isNotEmpty) {
      print('Found Dashboard, preamble complete');
      return;
    }

    // Check for Login screen
    if (find.byKey(const Key('phoneInput')).evaluate().isNotEmpty) {
      print('Found Login screen, preamble complete');
      return;
    }

    // Handle Legal
    if (find.byKey(const Key('acceptCheckbox')).evaluate().isNotEmpty) {
      print('Found Legal screen, accepting and continuing');
      await tester.tap(find.byKey(const Key('acceptCheckbox')));
      await settle(tester);
      await tester.tap(find.byKey(const Key('continueLegalButton')));
      continue;
    }

    // Handle Permissions
    final continuePermissions =
        find.byKey(const Key('continuePermissionsButton'));
    if (continuePermissions.evaluate().isNotEmpty) {
      print('Preamble: Found Permissions screen, tapping continue');
      await tester.tap(continuePermissions);
      await tester.pumpAndSettle();
      continue;
    }

    // Handle Auth Choice
    final loginWithPhone = find.byKey(const Key('loginWithPhoneButton'));
    if (loginWithPhone.evaluate().isNotEmpty) {
      print('Preamble: Found Auth Choice screen, tapping Login with Phone');
      await tester.tap(loginWithPhone);
      await tester.pumpAndSettle();
      continue;
    }

    // If none of the above, wait a bit and try again
    print('No known preamble screen found, waiting... ($i)');
    await tester.pump(const Duration(seconds: 1));
  }
}

/// Idempotently handle the legal/terms acceptance screen if shown.
/// Taps the checkbox and continue button. Safe no-op if screen not present.
Future<void> completeLegalScreen(WidgetTester tester) async {
  final end = DateTime.now().add(const Duration(seconds: 5));
  while (DateTime.now().isBefore(end)) {
    await settle(tester);
    if (find.byKey(const Key('acceptCheckbox')).evaluate().isNotEmpty) {
      await tester.tap(find.byKey(const Key('acceptCheckbox')));
      await settle(tester);
      await tester.tap(find.byKey(const Key('continueLegalButton')));
      await settle(tester);
      return;
    }
    await tester.pump(const Duration(milliseconds: 500));
  }
}

/// Idempotently handle the permissions screen if shown.
/// Taps the continue button (and any allow* buttons if visible).
Future<void> completePermissionsScreen(WidgetTester tester) async {
  final end = DateTime.now().add(const Duration(seconds: 5));
  while (DateTime.now().isBefore(end)) {
    await settle(tester);
    if (find
        .byKey(const Key('continuePermissionsButton'))
        .evaluate()
        .isNotEmpty) {
      // Try tapping common permission allow buttons if they appear (non-TEST_MODE flows)
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
        }
      }
      await tester.tap(find.byKey(const Key('continuePermissionsButton')));
      await settle(tester);
      return;
    }
    await tester.pump(const Duration(milliseconds: 500));
  }
}

/// Idempotently handle the auth choice screen if shown.
/// Taps the "Login with Phone" button.
Future<void> completeAuthChoiceScreen(WidgetTester tester) async {
  final end = DateTime.now().add(const Duration(seconds: 5));
  while (DateTime.now().isBefore(end)) {
    await settle(tester);
    if (find.byKey(const Key('loginWithPhoneButton')).evaluate().isNotEmpty) {
      await tester.tap(find.byKey(const Key('loginWithPhoneButton')));
      await settle(tester);
      return;
    }
    await tester.pump(const Duration(milliseconds: 500));
  }
}

/// Complete the full auth flow: phone entry → OTP verification.
/// Handles auth choice screen if present.
Future<void> completeAuthFlow(WidgetTester tester, {String? phone}) async {
  final phoneNum = phone ?? TestCredentials.phone;

  await handlePreamble(tester);
  if (find.byKey(const Key('dashboardTab')).evaluate().isNotEmpty) return;

  await waitFor(tester, find.byKey(const Key('phoneInput')));
  await tester.enterText(
    find.byKey(const Key('phoneInput')),
    phoneNum,
  );
  await settle(tester);
  await tester.pump(const Duration(milliseconds: 300));

  // Scroll the login screen so the button is visible, then tap it
  final btnFinder = find.byKey(const Key('sendOtpButton'));
  final scrollable = find.byType(Scrollable).first;
  await tester.scrollUntilVisible(btnFinder, 200, scrollable: scrollable);
  await settle(tester);
  await tester.tap(btnFinder);
  await settle(tester);

  // Wait for OTP screen
  await waitFor(tester, find.byKey(const Key('otpInputRow')),
      timeout: const Duration(seconds: 15));
  final otpRow = find.byKey(const Key('otpInputRow'));
  final otpFields = find.descendant(
    of: otpRow,
    matching: find.byType(TextField),
  );

  final foundCount = otpFields.evaluate().length;
  if (foundCount >= 6) {
    for (int i = 0; i < 6; i++) {
      await tester.enterText(otpFields.at(i), TestCredentials.otp[i]);
      await tester.pump();
    }
    await settle(tester);
  }

  // Scroll and tap verify button (same approach as send OTP button)
  final verifyBtn = find.byKey(const Key('verifyOtpButton'));
  final scrollable2 = find.byType(Scrollable).first;
  await tester.scrollUntilVisible(verifyBtn, 200, scrollable: scrollable2);
  await settle(tester);
  await tester.tap(verifyBtn);
  await settle(tester);

  // Wait for post-auth navigation
  await tester.pump(const Duration(seconds: 3));
  await settle(tester);

  // Handle post-OTP Legal screen if shown
  if (find.byKey(const Key('acceptCheckbox')).evaluate().isNotEmpty) {
    print('completeAuthFlow: Found post-OTP Legal screen, accepting and continuing');
    await tester.tap(find.byKey(const Key('acceptCheckbox')));
    await settle(tester);
    await tester.tap(find.byKey(const Key('continueLegalButton')));
    await settle(tester);
  }

  // Handle post-OTP Permissions screen if shown
  final continuePermissions = find.byKey(const Key('continuePermissionsButton'));
  if (continuePermissions.evaluate().isNotEmpty) {
    print('completeAuthFlow: Found post-OTP Permissions screen, tapping continue');
    await tester.tap(continuePermissions);
    await settle(tester);
  }
}

/// Complete the onboarding flow if shown (intent → user form → guarantor).
/// Handles each step by tapping the appropriate buttons. Safe no-op if a screen is skipped.
Future<void> completeOnboardingFlow(WidgetTester tester) async {
  if (find.byKey(const Key('dashboardTab')).evaluate().isNotEmpty) return;

  // Intent of use screen: select "Deliver with Us" and confirm.
  if (find.text('Deliver with Us').evaluate().isNotEmpty) {
    await tester.tap(find.text('Deliver with Us'));
    await settle(tester);
    await tester.tap(find.text('Confirm Selection'));
    await settle(tester);
  }

  // User onboarding form: fill all fields and tap "Next".
  final nextBtn = find.byKey(const Key('nextOnboardingButton'));
  if (nextBtn.evaluate().isNotEmpty) {
    final fullNameField = find.byKey(const Key('fullNameField'));
    if (fullNameField.evaluate().isNotEmpty) {
      await tester.enterText(fullNameField, TestCredentials.fullName);
      await tester.enterText(
          find.byKey(const Key('emailField')), TestCredentials.email);
      await tester.enterText(
          find.byKey(const Key('fatherNameField')), TestCredentials.fatherName);
      await tester.enterText(
          find.byKey(const Key('motherNameField')), TestCredentials.motherName);
      await settle(tester);

      // DOB field: tap the hint text "DD-MM-YYYY" to open DatePicker,
      // then confirm with the default date (Jan 1, 2000).
      final dobHint = find.text('DD-MM-YYYY');
      if (dobHint.evaluate().isNotEmpty) {
        await tester.tap(dobHint);
        await settle(tester);
        await tester.pump(const Duration(seconds: 1));
        await settle(tester);
        // Tap OK on the DatePicker dialog (default date is selected)
        final okBtn = find.text('OK');
        if (okBtn.evaluate().isNotEmpty) {
          await tester.tap(okBtn);
          await settle(tester);
        }
      }
    }
    await tester.tap(nextBtn);
    await settle(tester);
  }

  // Guarantor form: tap the "Finish Setup" button (enabled in TEST_MODE).
  final completeBtn = find.byKey(const Key('completeOnboardingButton'));
  if (completeBtn.evaluate().isNotEmpty) {
    final guarantorNameField = find.byKey(const Key('guarantorNameField'));
    if (guarantorNameField.evaluate().isNotEmpty) {
      await tester.enterText(guarantorNameField, TestCredentials.guarantorName);
      final guarantorPhoneField = find.byKey(const Key('guarantorPhoneField'));
      if (guarantorPhoneField.evaluate().isNotEmpty) {
        await tester.enterText(
            guarantorPhoneField, TestCredentials.guarantorPhone);
      }
      await tester.enterText(find.byKey(const Key('guarantorFatherNameField')),
          TestCredentials.fatherName);
      await tester.enterText(find.byKey(const Key('guarantorMotherNameField')),
          TestCredentials.motherName);
      await settle(tester);
    }
    await tester.tap(completeBtn);
    await settle(tester);
  }

  // Allow any final navigation/animations to settle.
  await tester.pump(const Duration(seconds: 2));
  await settle(tester);
}

/// Navigate to a specific bottom nav tab.
Future<void> navigateToTab(WidgetTester tester, String tabKey) async {
  await tester.tap(find.byKey(Key(tabKey)));
  await settle(tester);
}

/// Verify we're on the dashboard by checking for key elements.
Future<void> expectOnDashboard(WidgetTester tester) async {
  await waitFor(tester, find.byKey(const Key('dashboardTab')));
  await settle(tester);

  // Wait for each critical element to appear
  final criticalElements = [
    find.byKey(const Key('dashboardTab')),
    find.byKey(const Key('notificationBell')),
    find.byKey(const Key('assignedVehicleCard')),
  ];

  for (final element in criticalElements) {
    await waitFor(tester, element, timeout: const Duration(seconds: 20));
    expect(element, findsAtLeastNWidgets(1),
        reason: 'Dashboard element not found: $element');
  }
  await settle(tester);
}

/// Helper to go back, handling custom back buttons.
Future<void> goBack(WidgetTester tester) async {
  final backButtons = [
    find.byKey(const Key('backButton')),
    find.byIcon(Icons.arrow_back),
    find.byIcon(Icons.arrow_back_ios),
    find.byIcon(Icons.close),
  ];

  for (final btn in backButtons) {
    if (btn.evaluate().isNotEmpty) {
      await tester.tap(btn.first);
      await settle(tester);
      return;
    }
  }

  // Fallback: try to pop the navigator directly if no button found
  try {
    final nav = tester.state<NavigatorState>(find.byType(Navigator).last);
    nav.pop();
  } catch (e) {
    print('goBack failed: $e');
  }
  await settle(tester);
}

/// Verify we're on the login screen.
void expectOnLogin(WidgetTester tester) {
  expect(find.byKey(const Key('phoneInput')), findsOneWidget);
  expect(find.byKey(const Key('sendOtpButton')), findsOneWidget);
}

/// Verify we're on the auth choice screen.
void expectOnAuthChoice(WidgetTester tester) {
  expectOnLogin(tester);
}

/// Scroll to find a widget that may be off-screen.
Future<void> scrollToAndTap(
  WidgetTester tester,
  Finder finder, {
  Finder? scrollable,
}) async {
  if (scrollable != null) {
    await tester.dragUntilVisible(
      finder,
      scrollable,
      const Offset(0, -100),
    );
  } else {
    await tester.dragUntilVisible(
      finder,
      find.byType(Scrollable),
      const Offset(0, -100),
    );
  }
  await settle(tester);
  await tester.tap(finder);
  await settle(tester);
}

/// Full setup: launch → legal → permissions → auth → onboarding (if needed).
/// Skips steps already completed based on current app state.
/// Returns true if user reached dashboard.
Future<bool> fullLoginFlow(WidgetTester tester, {String? phone}) async {
  await launchApp(tester);

  // If we're already on the dashboard, we're done
  if (find.byKey(const Key('dashboardTab')).evaluate().isNotEmpty) {
    return true;
  }

  await handlePreamble(tester);

  // Re-check dashboard after preamble (unlikely but possible if state settled)
  if (find.byKey(const Key('dashboardTab')).evaluate().isNotEmpty) {
    return true;
  }

  await completeAuthFlow(tester, phone: phone);
  await completeOnboardingFlow(tester);

  // Check if we reached dashboard
  return find.byKey(const Key('dashboardTab')).evaluate().isNotEmpty;
}

/// Seeds a rider by running through onboarding flow in tests and caching the rider
/// so subsequent tests can reuse a known onboarding state.
Future<void> seedRiderViaOnboarding(WidgetTester tester) async {
  // Ensure a clean fresh start for onboarding seed
  await resetAppState();
  await safeAppMain();
  await settle(tester);
  // Use the existing onboarding helpers to create a rider via UI
  await completeAuthFlow(tester, phone: TestCredentials.phone);
  await completeOnboardingFlow(tester);
  // Cache the seeded rider for reuse by subsequent tests
  final rider = {
    'id': 'seeded-onboard-${DateTime.now().millisecondsSinceEpoch}',
    'phone': TestCredentials.phone,
    'name': TestCredentials.fullName,
    'status': 'ACTIVE',
  };
  await CacheService().init();
  await CacheService().cacheRider(rider);
}
