import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../helpers/test_helpers.dart';

/// PageObject for the App Settings screen
/// (`features/profile/presentation/screens/settings_screen.dart`).
///
/// P2-9 (review, 2026-09-07): the previous version exposed `settingsButton`
/// and `appSettingsLink` keys that don't exist on the current screen —
/// the source has `appVersionTile`/`backButton`/`themeOption`/etc.
/// and the `appSettingsLink` key is on Profile, not App Settings. Tests
/// using the stale keys fell through to silent `if (key.exists) { ... }`
/// branches and contributed nothing. This rewrite lists the keys
/// that actually exist on the screen today; consumers that need
/// PageObject-style locators can `find.byKey` directly while the
/// PageObject is being refactored.
class SettingsPageObject {
  final WidgetTester tester;

  SettingsPageObject(this.tester);

  // ── App bar + back ─────────────────────────────────────────────
  Finder get settingsAppBar => find.byKey(const Key('settingsAppBar'));
  Finder get backButton => find.byKey(const Key('backButton'));

  // ── Tri-state theme (appearance) selector ───────────────────────
  Finder get themeOption => find.byKey(const Key('themeOption'));
  Finder get themeSystemRadio => find.byKey(const Key('themeSystemRadio'));
  Finder get themeLightRadio => find.byKey(const Key('themeLightRadio'));
  Finder get themeDarkRadio => find.byKey(const Key('themeDarkRadio'));

  // ── Language picker ────────────────────────────────────────────
  Finder get languageOption => find.byKey(const Key('languageOption'));

  // ── Notifications master switch (delegates to
  //    `notificationPrefsProvider`; P2-3 audit) ──────────────────
  Finder get notificationsTile => find.byKey(const Key('notificationsTile'));
  Finder get notificationsSwitch =>
      find.byKey(const Key('notificationsSwitch'));

  // ── Edit profile / change password / privacy / terms / feedback ─
  Finder get editProfileTile => find.byKey(const Key('editProfileTile'));
  Finder get changePasswordTile =>
      find.byKey(const Key('changePasswordTile'));
  Finder get privacyTile => find.byKey(const Key('privacyTile'));
  Finder get termsTile => find.byKey(const Key('termsTile'));
  Finder get feedbackLink => find.byKey(const Key('feedbackLink'));

  // ── Rate Us (P2-5 audit: canLaunchUrl + error toast) ──────────
  Finder get rateUsTile => find.byKey(const Key('rateUsTile'));

  // ── App version display + delete account ──────────────────────
  Finder get appVersionTile => find.byKey(const Key('appVersionTile'));
  Finder get deleteAccountButton =>
      find.byKey(const Key('deleteAccountButton'));
  Finder get confirmDeleteButton =>
      find.byKey(const Key('confirmDeleteButton'));
  Finder get cancelDeleteButton =>
      find.byKey(const Key('cancelDeleteButton'));

  // ── Lock / verify lock dialog (P0-4, F-001 family) ──────────────
  Finder get lockPasswordInput =>
      find.byKey(const Key('lockPasswordInput'));
  Finder get newLockPasswordInput =>
      find.byKey(const Key('newLockPasswordInput'));
  Finder get confirmNewLockPasswordInput =>
      find.byKey(const Key('confirmNewLockPasswordInput'));
  Finder get confirmChangeLockButton =>
      find.byKey(const Key('confirmChangeLockButton'));
  Finder get confirmVerifyLockButton =>
      find.byKey(const Key('confirmVerifyLockButton'));
}
