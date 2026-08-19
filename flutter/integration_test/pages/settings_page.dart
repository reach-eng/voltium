import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../helpers/test_helpers.dart';

class SettingsPageObject {
  final WidgetTester tester;

  SettingsPageObject(this.tester);

  // Locators
  Finder get settingsButton => find.byKey(const Key('settingsButton'));
  Finder get appSettingsLink => find.byKey(const Key('appSettingsLink'));
  Finder get backButton => find.byKey(const Key('backButton'));

  // Tri-state theme (appearance) selector
  Finder get themeOption => find.byKey(const Key('themeOption'));
  Finder get themeSystemRadio => find.byKey(const Key('themeSystemRadio'));
  Finder get themeLightRadio => find.byKey(const Key('themeLightRadio'));
  Finder get themeDarkRadio => find.byKey(const Key('themeDarkRadio'));
}
