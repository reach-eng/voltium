import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/wallet_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';

/// Wallet Screen Widget Tests
///
/// Tests the WalletScreen display, balance formatting, and top-up flow entry.

/// PR-3 (2026-08-21): removed the `_TestAppProvider extends AppProvider` shim
/// — WalletScreen reads `riderProvider` / `walletProvider` directly. The static
/// notifiers below provide the seed data the screen expects.
class _StaticRiderNotifier extends RiderNotifier {
  @override
  RiderState build() => RiderState(
        rider: const RiderModel(
          riderId: '1',
          name: 'Test Rider',
          phone: '123',
          walletBalance: 100,
        ),
        riderId: '1',
        dataState: DataState.fresh,
      );
}

class _StaticWalletNotifier extends WalletNotifier {
  @override
  WalletState build() => const WalletState(transactions: []);
}

void main() {
  Widget buildWalletScreen() {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        riderProvider.overrideWith(() => _StaticRiderNotifier()),
        walletProvider.overrideWith(() => _StaticWalletNotifier()),
      ],
      child: const MaterialApp(
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
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      // Screen should render without throwing
      expect(find.byType(WalletScreen), findsOneWidget);

      // Exhaust FadeUpWidget timers to prevent 'Timer still pending' error
      // (PR-5 followup 2026-08-23: the new `ref.watch(walletProvider.select(
      // (p) => p.lastError))` introduces an extra rebuild path that can
      // re-schedule FadeUpWidget's `_startAnimation` timer; the
      // graduated pump pattern below drains it deterministically).
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
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
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
    });

    testWidgets('wallet screen has top-up action', (tester) async {
      await tester.pumpWidget(buildWalletScreen());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      // The top-up button is an icon button with key('topUpButton') in
      // WalletBalanceCard. Alternatively, look for any 'Add'/'Top' text or
      // the well-known key.
      final topUpByKey =
          find.byKey(const Key('topUpButton'), skipOffstage: false);
      final addMoneyFinder = find.textContaining('Add', skipOffstage: false);
      final topupFinder = find.textContaining('Top', skipOffstage: false);
      final hasTopupAction = topUpByKey.evaluate().isNotEmpty ||
          addMoneyFinder.evaluate().isNotEmpty ||
          topupFinder.evaluate().isNotEmpty;
      expect(hasTopupAction, isTrue);

      // Exhaust FadeUpWidget timers to prevent 'Timer still pending' error
      // (PR-5 followup 2026-08-23: the new `ref.watch(walletProvider.select(
      // (p) => p.lastError))` introduces an extra rebuild path that can
      // re-schedule FadeUpWidget's `_startAnimation` timer; the
      // graduated pump pattern below drains it deterministically).
      await tester.pump(const Duration(milliseconds: 150));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
    });
  });
}
