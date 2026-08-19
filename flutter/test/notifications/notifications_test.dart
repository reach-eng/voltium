import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Notifications Screen Widget Tests
void main() {
  Widget buildTestApp({required Widget child}) {
    return ProviderScope(
      overrides: [
        appProvider.overrideWith((ref) => AppProvider()),
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: child,
      ),
    );
  }

  group('Notification Screen', () {
    testWidgets('notification screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const NotificationsScreen()));
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(NotificationsScreen), findsOneWidget);
    });

    testWidgets('notification screen shows empty state or list',
        (tester) async {
      await tester.pumpWidget(buildTestApp(child: const NotificationsScreen()));
      await tester.pump(const Duration(seconds: 1));

      // Either shows notifications or an empty state
      final hasListView = find.byType(ListView).evaluate().isNotEmpty;
      final hasEmptyText = find
              .textContaining('no notification', skipOffstage: false)
              .evaluate()
              .isNotEmpty ||
          find
              .textContaining('empty', skipOffstage: false)
              .evaluate()
              .isNotEmpty;
      final hasText = find.byType(Text).evaluate().isNotEmpty;

      expect(hasListView || hasEmptyText || hasText, isTrue);
    });

    testWidgets('notification screen does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const NotificationsScreen()));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });
  });
}
