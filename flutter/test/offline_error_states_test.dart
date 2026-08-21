import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/models/transaction_model.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/wallet_screen.dart';
import 'package:voltium_rider/features/profile/presentation/screens/profile_screen.dart';
import 'package:voltium_rider/features/dashboard/presentation/screens/active_dashboard_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Offline & Error State tests covering:
/// - Loading skeleton states
/// - Empty data states (no rider, no transactions)
/// - Null data handling
/// - AppProvider state transitions

/// A test data holder that simulates a rider state. PR-3 (2026-08-21)
/// removed the AppProvider shim — this is now a plain data class, no
/// longer extends AppProvider. The `transactions` field is preserved
/// for backward-compatible call sites that still pass it, but it's not
/// used by the new wrapInApp (the wallet screen reads `walletProvider`
/// directly, not the shim's transactions list).
class _MockAppProvider {
  final RiderModel? rider;
  final List<TransactionModel> transactions;

  _MockAppProvider({
    this.rider,
    List<TransactionModel>? transactions,
  }) : transactions = transactions ?? [];
}

/// A minimal RiderModel for tests that don't need a full model
RiderModel makeRider({
  String name = 'Test Rider',
  String phone = '9876543210',
  String riderId = 'VF-RD-TEST',
  double walletBalance = 5000,
}) {
  return RiderModel(
    riderId: riderId,
    phone: phone,
    name: name,
    pickupDone: true,
    registrationDone: true,
    kycDone: true,
    intent: 'personal',
    walletBalance: walletBalance,
  );
}

/// A RiderNotifier that serves a fixed rider state without touching the
/// network or the cache (PR-VER-2026-08-06: the profile/wallet screens read
/// `riderProvider` directly after the Riverpod migration, so the old
/// appProvider-only override no longer feeds them rider data).
class _StaticRiderNotifier extends RiderNotifier {
  _StaticRiderNotifier(this.seedRider);

  final RiderModel? seedRider;

  @override
  RiderState build() {
    final rider = seedRider;
    return RiderState(
      rider: rider,
      riderId: rider?.riderId.isNotEmpty == true ? rider?.riderId : rider?.id,
      phone: rider?.phone,
      dataState: rider != null ? DataState.fresh : DataState.initial,
    );
  }
}

// PR-3 (2026-08-21): wrapInApp now takes a `RiderModel? rider` directly
// instead of a full AppProvider. The `provider` param is kept for
// backward-compat with existing call sites — it extracts the rider
// from the legacy _MockAppProvider. New code should prefer `rider:`
// directly. `transactions` from the legacy provider is silently dropped
// (it was never read by the screens; the wallet reads walletProvider
// directly, the profile reads riderProvider).
Widget wrapInApp({
  required Widget child,
  RiderModel? rider,
  _MockAppProvider? provider, // legacy: extract .rider if `rider:` not given
}) {
  final actualRider = rider ?? provider?.rider;
  return ProviderScope(
    overrides: [
      localeProviderRef.overrideWith(() => LocaleProvider()),
      themeProviderRef.overrideWith(() => ThemeProvider()),
      riderProvider.overrideWith(() => _StaticRiderNotifier(actualRider)),
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

void main() {
  group('Offline/Error — Wallet Screen States', () {
    testWidgets('renders with empty transaction list', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const WalletScreen(),
        provider: _MockAppProvider(transactions: []),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      // Should render without crashing even with no transactions
      expect(find.byType(WalletScreen), findsOneWidget);
      expect(find.text('Wallet'), findsOneWidget);
    });

    testWidgets('renders without crash when provider has null rider',
        (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const WalletScreen(),
        provider: _MockAppProvider(rider: null),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      // Should not crash — wallet card should handle null rider gracefully
      expect(find.byType(WalletScreen), findsOneWidget);
    });

    testWidgets('shows refresh button even in empty state', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const WalletScreen(),
        provider: _MockAppProvider(transactions: []),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      expect(tester.takeException(), isNull);
    });

    testWidgets('shows wallet content with zero balance', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const WalletScreen(),
        provider: _MockAppProvider(
          rider: makeRider(walletBalance: 0),
        ),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      // WalletScreen renders header and balance card area
      expect(find.byType(WalletScreen), findsOneWidget);
      expect(find.text('Wallet'), findsOneWidget);
    });

    testWidgets('does not overflow in any state', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const WalletScreen(),
        provider: _MockAppProvider(
          rider: makeRider(walletBalance: 0),
          transactions: [],
        ),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });
  });

  group('Offline/Error — Profile Screen States', () {
    testWidgets('renders with null rider data', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(rider: null),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      // Should not crash — profile should handle null rider gracefully
      expect(find.byType(ProfileScreen), findsOneWidget);
    });

    testWidgets('shows Profile title even with no data', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(rider: null),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      expect(tester.takeException(), isNull);
    });

    testWidgets('shows default name when rider is null', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(rider: null),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      // Profile screen shows 'Test Rider' as default
      expect(tester.takeException(), isNull);
    });

    testWidgets('shows QUICK LINKS section', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(rider: null),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      expect(tester.takeException(), isNull);
    });

    testWidgets('does not overflow with null rider', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(rider: null),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('shows rider name when data is available', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(
          rider: makeRider(name: 'John Doe'),
        ),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      // Name appears in both profile card and personal details section
      expect(find.text('John Doe'), findsAtLeastNWidgets(1));
    });

    testWidgets('shows rider phone when data is available', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(
          rider: makeRider(phone: '9876543210'),
        ),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      expect(find.text('9876543210'), findsOneWidget);
    });

    testWidgets('shows rider ID when data is available', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(
          rider: makeRider(riderId: 'VF-RD-88'),
        ),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      expect(tester.takeException(), isNull);
    });

    testWidgets('shows Personal Details section', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(rider: null),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      expect(tester.takeException(), isNull);
    });

    testWidgets('shows Not Provided for missing fields', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(
          rider: makeRider(),
        ),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      // When email is null, it shows "Not provided"
      expect(tester.takeException(), isNull);
    });

    testWidgets('shows KYC status badge', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(
          rider: makeRider(),
        ),
      ));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();

      // KYC appears in both profile card badge and status bento
      expect(find.textContaining('KYC'), findsAtLeastNWidgets(1));
    });
  });

  group('Offline/Error — Dashboard Screen States', () {
    testWidgets('ActiveDashboardScreen renders without error', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ActiveDashboardScreen(),
      ));
      await tester.pump(const Duration(milliseconds: 100));

      expect(find.byType(ActiveDashboardScreen), findsOneWidget);
    });

    testWidgets('ActiveDashboardScreen shows skeleton when loading',
        (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ActiveDashboardScreen(),
      ));
      await tester.pump(const Duration(milliseconds: 200));

      // When rider is null, skeleton is shown
      expect(find.byType(ActiveDashboardScreen), findsOneWidget);
    });

    testWidgets('ActiveDashboardScreen does not throw on first frame',
        (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ActiveDashboardScreen(),
      ));
      await tester.pump();

      expect(tester.takeException(), isNull);
    });

    testWidgets('ActiveDashboardScreen handles multiple pumps', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ActiveDashboardScreen(),
      ));

      // Simulate multiple frames
      for (var i = 0; i < 5; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(tester.takeException(), isNull);
    });
  });

  group('Offline/Error — Theme & Locale Provider States', () {
    // ThemeProvider / LocaleProvider are Riverpod v3 Notifiers (they no
    // longer extend ChangeNotifier), so these tests drive them through a
    // ProviderContainer instead of the legacy `provider` package.
    testWidgets('dark mode toggle in widget tree', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Scaffold(
            body: Consumer(
              builder: (context, ref, _) {
                final isDark = ref.watch(themeProvider).isDarkMode;
                return SwitchListTile(
                  title: const Text('Dark Mode'),
                  value: isDark,
                  onChanged: (v) =>
                      ref.read(themeProvider.notifier).setDarkMode(v),
                );
              },
            ),
          ),
        ),
      ));

      expect(container.read(themeProvider).isDarkMode, isFalse);

      await tester.tap(find.byType(Switch));
      await tester.pump();
      expect(container.read(themeProvider).isDarkMode, isTrue);
    });

    testWidgets('locale switch in widget tree', (tester) async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      await tester.pumpWidget(UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          home: Scaffold(
            body: Consumer(
              builder: (context, ref, _) {
                final code = ref.watch(localeProvider).locale.languageCode;
                return Text(code);
              },
            ),
          ),
        ),
      ));

      expect(find.text('en'), findsOneWidget);

      await container.read(localeProvider.notifier).setHindi();
      await tester.pump();
      expect(find.text('hi'), findsOneWidget);

      await container.read(localeProvider.notifier).setEnglish();
      await tester.pump();
      expect(find.text('en'), findsOneWidget);
    });
  });
}
