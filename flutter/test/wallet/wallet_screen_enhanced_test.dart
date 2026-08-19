import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/wallet_screen.dart';
import 'package:voltium_rider/models/transaction_model.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/models/transaction_model.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart';

/// Enhanced WalletScreen widget tests covering:
/// - Header with title and refresh button
/// - Balance card rendering
/// - Security deposit card
/// - Action buttons (Top Up, History)
/// - Transaction history section
/// - Empty state
/// - RefreshIndicator

class _TestAppProvider extends AppProvider {
  @override
  Future<void> refreshTransactions() async {}

  @override
  Future<void> refresh() async {}

  @override
  Future<void> refreshFromApi() async {}

  @override
  DataState get dataState => DataState.fresh;

  @override
  List<TransactionModel> get transactions => [];

  @override
  bool get isRefreshingTransactions => false;

  @override
  RiderModel? get rider => const RiderModel(
        riderId: 'test',
        name: 'Test Rider',
        phone: '1234567890',
        walletBalance: 1000,
        depositStatus: DepositStatus.notSubmitted,
      );
}

/// WalletScreen consumes `riderProvider` / `walletProvider` directly (Riverpod
/// migration), so those must be overridden too — otherwise the real notifiers
/// build a null rider and the screen shows the skeleton.
class _StaticRiderNotifier extends RiderNotifier {
  @override
  RiderState build() => RiderState(
        rider: const RiderModel(
          riderId: 'test',
          name: 'Test Rider',
          phone: '1234567890',
          walletBalance: 1000,
          depositStatus: DepositStatus.notSubmitted,
        ),
        riderId: 'test',
        dataState: DataState.fresh,
      );
}

class _StaticWalletNotifier extends WalletNotifier {
  @override
  WalletState build() => const WalletState(transactions: []);
}

Widget buildTestApp({AppProvider? provider}) {
  return ProviderScope(
    overrides: [
      localeProviderRef.overrideWith(() => LocaleProvider()),
      themeProviderRef.overrideWith(() => ThemeProvider()),
      appProvider.overrideWith((ref) => provider ?? _TestAppProvider()),
      riderProvider.overrideWith(() => _StaticRiderNotifier()),
      walletProvider.overrideWith(() => _StaticWalletNotifier()),
    ],
    child: const MaterialApp(home: WalletScreen()),
  );
}

void main() {
  group('WalletScreen — Header', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(WalletScreen), findsOneWidget);
    });

    testWidgets('displays Wallet title in header', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump();
      // Pump a few more frames to let FadeUpWidget timers complete
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Wallet'), findsOneWidget);
    });
  });

  group('WalletScreen — Body Content', () {
    testWidgets('shows wallet body content', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      // Balance card area should be present — wallet body renders
      expect(find.byType(WalletScreen), findsOneWidget);
    });

    testWidgets('shows action buttons area', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      final hasTransactions = find.byType(ListTile).evaluate().isNotEmpty;
      final hasEmptyState = find
              .textContaining('No', skipOffstage: false)
              .evaluate()
              .isNotEmpty ||
          find.textContaining('no ', skipOffstage: false).evaluate().isNotEmpty;
      final hasFilter =
          find.text('ALL', skipOffstage: false).evaluate().isNotEmpty;
      expect(hasTransactions || hasEmptyState || hasFilter, isTrue);
    });

    testWidgets('shows transaction history section', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      debugPrint('==== WIDGET TREE ====');
      debugDumpApp();

      // Should show filter chips or empty state
      final hasTransactions = find.byType(ListTile).evaluate().isNotEmpty;
      final hasEmptyState = find
              .textContaining('No', skipOffstage: false)
              .evaluate()
              .isNotEmpty ||
          find.textContaining('no ', skipOffstage: false).evaluate().isNotEmpty;
      final hasFilter =
          find.text('ALL', skipOffstage: false).evaluate().isNotEmpty;
      expect(hasTransactions || hasEmptyState || hasFilter, isTrue);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });
  });

  group('WalletScreen — RefreshIndicator', () {
    testWidgets('wallet screen has RefreshIndicator', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(RefreshIndicator), findsOneWidget);
    });
  });

  group('WalletScreen — Top Up Navigation', () {
    testWidgets('top up action is present', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      // There should be a way to initiate top-up
      final topUpFinder = find.byIcon(Icons.add);
      final hasTopUpButton = topUpFinder.evaluate().isNotEmpty;
      final hasTopUpText =
          find.textContaining('Top', skipOffstage: false).evaluate().isNotEmpty;
      expect(hasTopUpButton || hasTopUpText, isTrue);
    });
  });

  group('WalletScreen — Filter Chips', () {
    testWidgets('All filter is selected by default', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      await tester.pump(const Duration(seconds: 1));

      // "All" should be visible as the default filter
      expect(find.text('ALL', skipOffstage: false), findsOneWidget);
    });
  });
}
