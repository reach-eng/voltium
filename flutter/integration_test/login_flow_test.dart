import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'helpers/test_helpers.dart';
import 'package:integration_test/integration_test.dart';
import 'package:voltium_rider/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Simple Login Flow - Reach Phone Input', (tester) async {
    await app.main();
    await settle(tester);

    print('[E2E-LOG] App started');

    // Wait for splash
    print('[E2E-LOG] Waiting for splash...');
    await tester.pump(const Duration(seconds: 4));
    await settle(tester);

    // Handle Legal
    await completeLegalScreen(tester);

    // Handle Permissions
    await completePermissionsScreen(tester);

    // Handle Auth Choice Screen
    final loginPhoneBtn = find.byKey(const Key('loginWithPhoneButton'));
    if (loginPhoneBtn.evaluate().isNotEmpty) {
      print('[E2E-LOG] Found Auth Choice, tapping Login with Phone');
      await tester.tap(loginPhoneBtn);
      await settle(tester);
    }

    // Reach Login
    print('[E2E-LOG] Reached Login?');
    final phoneInput = find.byKey(const Key('phoneInput'));
    expect(phoneInput, findsOneWidget);

    print('[E2E-LOG] Entering text...');
    await tester.enterText(phoneInput, '9876543210');
    await settle(tester);

    print('[E2E-LOG] Tapping Send OTP');
    await tester.ensureVisible(find.byKey(const Key('sendOtpButton')));
    await tester.tap(find.byKey(const Key('sendOtpButton')));
    await settle(tester);

    print('[E2E-LOG] Reached OTP?');
    expect(find.byKey(const Key('otpInputRow')), findsOneWidget);
  });
}
