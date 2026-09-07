import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

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

  // App Settings entry — the `appSettingsLink` QuickLinkItem on the
  // Profile screen (profile_screen.dart:193 / profile_widgets.dart:590)
  // navigates to SettingsScreen. This was the missing getter in the
  // previous Settings page-object comment ("appSettingsLink is on
  // Profile, not App Settings") — the key actually exists, but no
  // page-object accessor was exposed, so tests that did
  // `app.settings.appSettingsLink` silently fell through to the
  // `if (key.exists) { ... }` guard and the Settings flow never
  // ran. Gap 9 of the 2026-09-08 audit adds this getter.
  Finder get appSettingsLink => find.byKey(const Key('appSettingsLink'));
}
