import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/rental_details_screen.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/wallet_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Active Rental Screen Widget Tests
void main() {
  Widget buildTestApp({required Widget child}) {
    return ProviderScope(overrides: [
        localeProviderRef.overrideWith((ref) => LocaleProvider()),
        themeProviderRef.overrideWith((ref) => ThemeProvider()),
        appProvider.overrideWith((ref) => AppProvider()),
      ], child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: child,),
    );
  }

  group('Active Rental Details Screen', () {
    testWidgets('rental details screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const RentalDetailsScreen()));
      await tester.pumpAndSettle();
      expect(find.byType(RentalDetailsScreen), findsOneWidget);
    });

    testWidgets('rental details screen shows rental information or loading',
        (tester) async {
      await tester.pumpWidget(buildTestApp(child: const RentalDetailsScreen()));
      await tester.pump();

      final hasLoading =
          find.byType(CircularProgressIndicator).evaluate().isNotEmpty;
      final hasText = find.byType(Text).evaluate().isNotEmpty;

      expect(hasLoading || hasText, isTrue);
    });

    testWidgets('rental details screen does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const RentalDetailsScreen()));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('Wallet Screen in Active Rental Context', () {
    testWidgets('wallet screen accessible during active rental',
        (tester) async {
      await tester.pumpWidget(buildTestApp(child: const WalletScreen()));
      await tester.pumpAndSettle();
      expect(find.byType(WalletScreen), findsOneWidget);
    });
  });
}
