import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/profile/presentation/screens/app_settings_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';

Widget buildTestApp() {
  return ProviderScope(
    overrides: [
      localeProviderRef.overrideWith((ref) => LocaleProvider()),
      themeProviderRef.overrideWith((ref) => ThemeProvider()),
    ],
    child: const MaterialApp(home: AppSettingsScreen()),
  );
}

void main() {
  group('App Settings Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.byType(AppSettingsScreen), findsOneWidget);
    });

    testWidgets('displays settings title', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Settings'), findsOneWidget);
    });

    testWidgets('shows dark mode toggle', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.byKey(const Key('darkModeSwitch')), findsWidgets);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
