import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../helpers/test_helpers.dart';

class ProfilePageObject {
  final WidgetTester tester;

  ProfilePageObject(this.tester);

  // Locators
  Finder get editProfileButton => find.byKey(const Key('editProfileButton'));
  Finder get editFullNameField => find.byKey(const Key('editFullNameField'));
  Finder get saveProfileButton => find.byKey(const Key('saveProfileButton'));
  Finder get profileNameField => find.byKey(const Key('profileNameField'));
  Finder get logoutButton => find.byKey(const Key('logoutButton'));
  Finder get profileTab => find.byKey(const Key('profileTab'));
  Finder get historyButton => find.byKey(const Key('historyButton'));
}
