import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../helpers/test_helpers.dart';

class SettingsPageObject {
  final WidgetTester tester;

  SettingsPageObject(this.tester);

  // Locators
  Finder get settingsButton => find.byKey(const Key('settingsButton'));
  Finder get darkModeSwitch => find.byKey(const Key('darkModeSwitch'));
  Finder get appSettingsLink => find.byKey(const Key('appSettingsLink'));
  Finder get backButton => find.byKey(const Key('backButton'));
}
