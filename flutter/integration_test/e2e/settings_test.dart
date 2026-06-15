// integration_test/e2e/settings_test.dart
//
// Voltium – Settings E2E tests.
// Covers: dark mode, language, notifications, 2FA, delete account.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Settings E2E', () {
    testWidgets('Settings screen opens from profile', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('appSettingsLink')));
      await settle(tester);

      expect(find.textContaining('Settings'), findsOneWidget);
    });

    testWidgets('Settings – dark mode toggle', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('appSettingsLink')));
      await settle(tester);

      final darkModeSwitch = find.byKey(const Key('darkModeSwitch'));
      expect(darkModeSwitch, findsOneWidget);

      // Toggle dark mode
      await tester.tap(darkModeSwitch);
      await settle(tester);

      // Toggle back
      await tester.tap(darkModeSwitch);
      await settle(tester);
    });

    testWidgets('Settings – notifications toggle', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('appSettingsLink')));
      await settle(tester);

      final notificationsSwitch = find.byKey(const Key('notificationsSwitch'));
      if (notificationsSwitch.evaluate().isNotEmpty) {
        await tester.tap(notificationsSwitch);
        await settle(tester);
      }
    });

    testWidgets('Settings – language selection', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('appSettingsLink')));
      await settle(tester);

      final languageOption = find.byKey(const Key('languageOption'));
      if (languageOption.evaluate().isNotEmpty) {
        await tester.tap(languageOption);
        await settle(tester);

        // Language dialog should show English and Hindi options
        expect(find.byKey(const Key('englishRadio')), findsOneWidget);
        expect(find.byKey(const Key('hindiRadio')), findsOneWidget);

        // Select Hindi
        await tester.tap(find.byKey(const Key('hindiRadio')));
        await settle(tester);

        // Select English back
        await tester.tap(find.byKey(const Key('englishRadio')));
        await settle(tester);
      }
    });

    testWidgets('Settings – two-factor auth toggle', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('appSettingsLink')));
      await settle(tester);

      final twoFactorSwitch = find.byKey(const Key('twoFactorSwitch'));
      if (twoFactorSwitch.evaluate().isNotEmpty) {
        await tester.tap(twoFactorSwitch);
        await settle(tester);
      }
    });

    testWidgets('Settings – terms of service', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('appSettingsLink')));
      await settle(tester);

      final termsTile = find.byKey(const Key('termsTile'));
      if (termsTile.evaluate().isNotEmpty) {
        await tester.tap(termsTile);
        await settle(tester);
      }
    });

    testWidgets('Settings – privacy policy', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('appSettingsLink')));
      await settle(tester);

      final privacyTile = find.byKey(const Key('privacyTile'));
      if (privacyTile.evaluate().isNotEmpty) {
        await tester.tap(privacyTile);
        await settle(tester);
      }
    });

    testWidgets('Settings – rate us', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('appSettingsLink')));
      await settle(tester);

      final rateTile = find.byKey(const Key('rateUsTile'));
      if (rateTile.evaluate().isNotEmpty) {
        await tester.tap(rateTile);
        await settle(tester);
      }
    });

    testWidgets('Settings – change phone number', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('appSettingsLink')));
      await settle(tester);

      final changePhoneTile = find.byKey(const Key('changePhoneTile'));
      if (changePhoneTile.evaluate().isNotEmpty) {
        await tester.tap(changePhoneTile);
        await settle(tester);
      }
    });

    testWidgets('Settings – change password', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('appSettingsLink')));
      await settle(tester);

      final changePasswordTile = find.byKey(const Key('changePasswordTile'));
      if (changePasswordTile.evaluate().isNotEmpty) {
        await tester.tap(changePasswordTile);
        await settle(tester);
      }
    });

    testWidgets('Settings – delete account dialog', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('appSettingsLink')));
      await settle(tester);

      final deleteBtn = find.byKey(const Key('deleteAccountButton'));
      if (deleteBtn.evaluate().isNotEmpty) {
        await tester.tap(deleteBtn);
        await settle(tester);

        // Delete confirmation dialog should appear
        expect(find.byKey(const Key('cancelDeleteButton')), findsOneWidget);
        expect(find.byKey(const Key('confirmDeleteButton')), findsOneWidget);

        // Cancel
        await tester.tap(find.byKey(const Key('cancelDeleteButton')));
        await settle(tester);
      }
    });

    testWidgets('Settings – navigate back to profile', (tester) async {
      await fullLoginFlow(tester);
      await navigateToTab(tester, 'profileTab');

      await tester.tap(find.byKey(const Key('appSettingsLink')));
      await settle(tester);

      // Go back
      await tester.pageBack();
      await settle(tester);

      // Should be back on profile
      expect(find.byKey(const Key('logoutButton')), findsOneWidget);
    });
  });
}
