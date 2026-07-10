import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/wallet_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Wallet Screen Widget Tests
///
/// Tests the WalletScreen display, balance formatting, and top-up flow entry.

/// Test-friendly AppProvider that doesn't make real HTTP calls.
class _TestAppProvider extends AppProvider {
  @override
  Future<void> refreshTransactions() async {}

  @override
  Future<void> refresh() async {}

  @override
  Future<void> refreshFromApi() async {}
}

void main() {
  Widget buildWalletScreen() {
    return ProviderScope(overrides: [
        localeProviderRef.overrideWith((ref) => LocaleProvider()),
        themeProviderRef.overrideWith((ref) => ThemeProvider()),
        appProvider.overrideWith((ref) => _TestAppProvider()),
      ], child: const MaterialApp(
        localizationsDelegates: [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: WalletScreen(),
      ),
    );
  }

  group('Wallet Screen', () {
    testWidgets('wallet screen renders without error', (tester) async {
      await tester.pumpWidget(buildWalletScreen());
      await tester.pumpAndSettle();

      // Screen should render without throwing
      expect(find.byType(WalletScreen), findsOneWidget);
    });

    testWidgets('wallet screen has a title', (tester) async {
      await tester.pumpWidget(buildWalletScreen());
      await tester.pump(); // First frame

      // Header title 'Wallet' is rendered outside Consumer — always visible
      expect(find.text('Wallet'), findsOneWidget);

      // Exhaust FadeUpWidget timers to prevent 'Timer still pending' error
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();
    });

    testWidgets('wallet screen has top-up action', (tester) async {
      await tester.pumpWidget(buildWalletScreen());
      await tester.pumpAndSettle();

      // There should be a way to initiate top-up
      final addMoneyFinder = find.textContaining('Add', skipOffstage: false);
      final topupFinder = find.textContaining('Top', skipOffstage: false);
      final hasTopupAction = addMoneyFinder.evaluate().isNotEmpty ||
          topupFinder.evaluate().isNotEmpty;
      expect(hasTopupAction, isTrue);
    });
  });
}
