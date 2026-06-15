// integration_test/onboarding_flow_test.dart
import 'package:flutter_test/flutter_test.dart';
import 'helpers/test_helpers.dart';
import 'package:integration_test/integration_test.dart';
import 'package:voltium_rider/main.dart' as app;
import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Onboarding flow from splash to dashboard',
      (WidgetTester tester) async {
    print('Starting app.main()...');
    await app.main();
    await settle(tester);

    print('Waiting for splash screen...');
    await tester.pump(const Duration(seconds: 4));
    await settle(tester);

    print('--- Current Screen Check ---');

    // Check for Legal Screen
    final acceptFinder = find.textContaining('I Accept');
    if (acceptFinder.evaluate().isNotEmpty) {
      print('Found Legal screen, tapping Checkbox first');
      final checkboxFinder = find.byType(Checkbox);
      if (checkboxFinder.evaluate().isNotEmpty) {
        await tester.tap(checkboxFinder.first);
        await settle(tester);
      }

      print('Tapping I Accept');
      await tester.tap(acceptFinder);
      await settle(tester);
      await tester.pump(const Duration(seconds: 1)); // Transition wait
    }

    // Check for Permissions Screen
    final permContinueFinder = find.text('Continue');
    final cupertinoSwitchFinder = find.byType(CupertinoSwitch);
    if (cupertinoSwitchFinder.evaluate().isNotEmpty) {
      print('Found Permissions screen, tapping Continue');
      await tester.tap(permContinueFinder.first);
      await settle(tester);
      await tester.pump(const Duration(seconds: 1)); // Transition wait
    }

    print('Waiting for Login screen UI to stabilize...');
    await settle(tester);

    // NEW: Handle Auth Choice Screen if present
    final loginPhoneBtn = find.byKey(const Key('loginWithPhoneButton'));
    if (loginPhoneBtn.evaluate().isNotEmpty) {
      print('Found Auth Choice screen, tapping Login with Phone');
      await tester.tap(loginPhoneBtn);
      await settle(tester);
    }

    // Login screen - fill phone
    final phoneInput = find.byKey(const Key('phoneInput'));
    if (phoneInput.evaluate().isEmpty) {
      print('Could not find TextFormField on Login screen. Dumping widgets:');
      debugDumpApp();
      // Try to wait more
      await tester.pump(const Duration(seconds: 2));
      await settle(tester);
    }

    if (phoneInput.evaluate().isNotEmpty) {
      print('Entering phone number...');
      await tester.enterText(phoneInput.first, '9876543210');
      await settle(tester);

      print('Tapping Send OTP...');
      final sendOtpBtn = find.byKey(const Key('sendOtpButton'));
      await waitFor(tester, sendOtpBtn);
      await tester.ensureVisible(sendOtpBtn);
      await tester.tap(sendOtpBtn);
      await settle(tester);
    }

    print('Waiting for OTP screen...');
    await tester.pump(const Duration(seconds: 2));
    await settle(tester);

    print('Entering OTP...');
    final otpRow = find.byKey(const Key('otpInputRow'));
    await waitFor(tester, otpRow);

    final otpFields = find.descendant(
      of: otpRow,
      matching: find.byType(TextField),
    );

    final foundCount = otpFields.evaluate().length;
    print('Found $foundCount OTP fields in row');

    if (foundCount >= 6) {
      for (int i = 0; i < 6; i++) {
        await tester.enterText(otpFields.at(i), '1');
        await tester.pump();
      }
      await settle(tester);

      print('Tapping Verify & Proceed');
      await tester.tap(find.byKey(const Key('verifyOtpButton')));
      await settle(tester);
    } else {
      print(
          'ERROR: Expected 6 OTP fields, but found $foundCount. Attempting fallback entry...');
      // Fallback: enter full code into whatever is found
      if (foundCount > 0) {
        await tester.enterText(otpFields.first, '111111');
        await settle(tester);
        await tester.tap(find.byKey(const Key('verifyOtpButton')));
        await settle(tester);
      }
    }

    await tester.pump(const Duration(seconds: 2));
    await settle(tester);

    print('Waiting for subsequent onboarding screens...');

    // 1. Intent of Use Screen
    print('Waiting for Intent of Use screen...');
    await tester.pumpAndSettle(const Duration(seconds: 2));
    final intentCard = find.text('Deliver with Us');
    if (intentCard.evaluate().isNotEmpty) {
      print(
          'Found Intent of Use screen, selecting Delivery and tapping Confirm Selection');
      await tester.tap(intentCard);
      await settle(tester);

      final confirmBtn = find.text('Confirm Selection');
      await tester.tap(confirmBtn);
      await settle(tester);
    }

    // 2. User Onboarding Screen
    print('Waiting for User Onboarding screen...');
    await tester.pumpAndSettle(const Duration(seconds: 2));
    final userOnboardingTitle = find.text('Secure\nVerification.');
    if (userOnboardingTitle.evaluate().isNotEmpty) {
      print('Filling User Onboarding form...');
      final fields = find.byType(TextFormField);
      if (fields.evaluate().length >= 5) {
        await tester.enterText(fields.at(0), 'John Doe');
        await tester.enterText(fields.at(1), '01/01/1990');
        await tester.enterText(fields.at(2), 'john@example.com');
        await tester.enterText(fields.at(3), 'Father Name');
        await tester.enterText(fields.at(4), 'Mother Name');
      }
      await settle(tester);

      print('Tapping COMPLETE ONBOARDING');
      final completeButton = find.text('COMPLETE ONBOARDING');
      if (completeButton.evaluate().isNotEmpty) {
        await tester.tap(completeButton);
        await settle(tester);
      }
    }

    // 3. Guarantor Onboarding Screen
    print('Waiting for Guarantor Onboarding screen...');
    await tester.pumpAndSettle(const Duration(seconds: 2));
    final guarantorIndicator = find.text('Add a trusted backer.');
    if (guarantorIndicator.evaluate().isNotEmpty) {
      print('Filling Guarantor details...');
      final gFields = find.byType(TextFormField);
      if (gFields.evaluate().length >= 2) {
        await tester.enterText(gFields.at(0), 'Jane Doe');
        await tester.enterText(gFields.at(1), '9998887776');
      }
      await settle(tester);

      print('Tapping Submit Guarantor Details');
      final submitG = find.text('Submit Guarantor Details');
      if (submitG.evaluate().isNotEmpty) {
        await tester.tap(submitG);
        await settle(tester);
      }
    }

    print('Looking for Dashboard NavigationBar...');
    await settle(tester);
    await tester.pump(const Duration(seconds: 2));

    // Final check for Dashboard
    final navBar = find.byType(NavigationBar);
    if (navBar.evaluate().isEmpty) {
      print('Dashboard NavigationBar not found! Current state:');
      debugDumpApp();
    }
    expect(navBar, findsOneWidget);
    print('Full Onboarding Successful!');
  });
}
