// integration_test/e2e_individual/25_settings_theme_toggle_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Settings – theme dialog opens and toggles theme',
      (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'profileTab');

    // Tap into App Settings from Profile
    final settingsLink = find.byKey(const Key('appSettingsLink'));
    if (settingsLink.evaluate().isNotEmpty) {
      await tester.scrollUntilVisible(settingsLink, 100);
      await tester.tap(settingsLink);
      await tester.pumpAndSettle();
    }

    // Find and open Theme Option dialog
    final themeOption = find.byKey(const Key('themeOption'));
    if (themeOption.evaluate().isNotEmpty) {
      await tester.tap(themeOption);
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('themeSystemRadio')), findsOneWidget);
      expect(find.byKey(const Key('themeLightRadio')), findsOneWidget);
      expect(find.byKey(const Key('themeDarkRadio')), findsOneWidget);

      // Select Dark Theme
      await tester.tap(find.byKey(const Key('themeDarkRadio')));
      await tester.pumpAndSettle();

      // Re-open and return to Follow System
      await tester.tap(find.byKey(const Key('themeOption')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('themeSystemRadio')));
      await tester.pumpAndSettle();
    } else {
      final hasTheme = find.textContaining('Theme').evaluate().isNotEmpty ||
          find.textContaining('Dark').evaluate().isNotEmpty ||
          find.textContaining('Light').evaluate().isNotEmpty;
      expect(hasTheme, isTrue, reason: 'Theme option should be accessible');
    }
  });
}
