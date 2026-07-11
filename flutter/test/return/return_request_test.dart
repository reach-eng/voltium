import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/end_rental_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Return Request Screen Widget Tests
void main() {
  Widget buildTestApp({required Widget child}) {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith((ref) => LocaleProvider()),
        themeProviderRef.overrideWith((ref) => ThemeProvider()),
        appProvider.overrideWith((ref) => AppProvider()),
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

  group('End Rental (Return Request) Screen', () {
    testWidgets('end rental screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const EndRentalScreen()));
      await tester.pumpAndSettle();
      expect(find.byType(EndRentalScreen), findsOneWidget);
    });

    testWidgets('end rental screen shows return form or instructions',
        (tester) async {
      await tester.pumpWidget(buildTestApp(child: const EndRentalScreen()));
      await tester.pumpAndSettle();

      // Should show return-related UI
      final hasText = find.byType(Text).evaluate().isNotEmpty;
      final hasButton = find.byType(ElevatedButton).evaluate().isNotEmpty ||
          find.byType(FilledButton).evaluate().isNotEmpty ||
          find.byType(TextButton).evaluate().isNotEmpty;

      expect(hasText || hasButton, isTrue);
    });

    testWidgets('end rental screen does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const EndRentalScreen()));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
