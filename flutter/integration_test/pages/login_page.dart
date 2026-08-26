import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../helpers/test_helpers.dart';

class LoginPageObject {
  final WidgetTester tester;

  LoginPageObject(this.tester);

  // Locators
  Finder get phoneField => find.byKey(const Key('phoneInput'));
  Finder get getOtpButton => find.byKey(const Key('sendOtpButton'));
  Finder get otpField => find.byKey(const Key('otpInputRow'));
  Finder get verifyOtpButton => find.byKey(const Key('verifyOtpButton'));

  // Actions
  Future<void> enterPhone(String phone) async {
    await smartEnterText(tester, phoneField, phone);
  }

  Future<void> tapGetOtp() async {
    await scrollAndTap(tester, getOtpButton);
    await tester.pumpAndSettle();
  }

  Future<void> enterOtp(String otp) async {
    await smartEnterText(tester, otpField, otp);
  }

  Future<void> tapVerifyOtp() async {
    await scrollAndTap(tester, verifyOtpButton);
    await tester.pumpAndSettle();
  }

  // Flows
  Future<void> login(String phone, String otp) async {
    await enterPhone(phone);
    await tapGetOtp();
    await enterOtp(otp);
    await tapVerifyOtp();
  }
}
