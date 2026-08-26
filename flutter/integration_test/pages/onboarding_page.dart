import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../helpers/test_helpers.dart';

class OnboardingPageObject {
  final WidgetTester tester;

  OnboardingPageObject(this.tester);

  // Locators
  Finder get acceptCheckbox => find.byKey(const Key('acceptCheckbox'));
  Finder get continueLegalButton =>
      find.byKey(const Key('continueLegalButton'));
  Finder get continuePermissionsButton =>
      find.byKey(const Key('continuePermissionsButton'));
  Finder get deliverWithUsCard => find.byKey(const Key('deliverWithUsCard'));
  Finder get nextOnboardingButton =>
      find.byKey(const Key('nextOnboardingButton'));
  Finder get fullNameField => find.byKey(const Key('fullNameField'));
  Finder get emailField => find.byKey(const Key('emailField'));
  Finder get fatherNameField => find.byKey(const Key('fatherNameField'));
  Finder get motherNameField => find.byKey(const Key('motherNameField'));
  Finder get guarantorNameField => find.byKey(const Key('guarantorNameField'));
  Finder get guarantorPhoneField =>
      find.byKey(const Key('guarantorPhoneField'));
  Finder get guarantorFatherNameField =>
      find.byKey(const Key('guarantorFatherNameField'));
  Finder get guarantorMotherNameField =>
      find.byKey(const Key('guarantorMotherNameField'));
  Finder get completeOnboardingButton =>
      find.byKey(const Key('completeOnboardingButton'));
  Finder get declarationCheckbox =>
      find.byKey(const Key('declarationCheckbox'));
  Finder get uploadProofArea => find.byKey(const Key('uploadProofArea'));
  Finder get submitProofButton => find.byKey(const Key('submitProofButton'));
  Finder get allowLocationButton =>
      find.byKey(const Key('allowLocationButton'));
  Finder get allowContactsButton =>
      find.byKey(const Key('allowContactsButton'));
  Finder get allowCameraButton => find.byKey(const Key('allowCameraButton'));
  Finder get allowNotificationsButton =>
      find.byKey(const Key('allowNotificationsButton'));
  Finder get getStartedButton => find.byKey(const Key('getStartedButton'));
  Finder get loginWithPhoneButton =>
      find.byKey(const Key('loginWithPhoneButton'));
  Finder get continueToPaymentButton =>
      find.byKey(const Key('continueToPaymentButton'));
}
