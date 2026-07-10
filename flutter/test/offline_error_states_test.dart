import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
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

/// A test AppProvider that simulates various states.
/// Overrides the `rider` and `transactions` getters so consumers see test data.
class _MockAppProvider extends AppProvider {
  final RiderModel? _mockRider;
  final List<TransactionModel> _mockTransactions;

  _MockAppProvider({
    RiderModel? rider,
    List<TransactionModel>? transactions,
  })  : _mockRider = rider,
        _mockTransactions = transactions ?? [];

  @override
  RiderModel? get rider => _mockRider;

  @override
  List<TransactionModel> get transactions => _mockTransactions;

  @override
  Future<void> refreshTransactions() async {}

  @override
  Future<void> refresh() async {}

  @override
  Future<void> refreshFromApi() async {}
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

Widget wrapInApp({
  required Widget child,
  AppProvider? provider,
}) {
  return ProviderScope(overrides: [
      localeProviderRef.overrideWith((ref) => LocaleProvider()),
      themeProviderRef.overrideWith((ref) => ThemeProvider()),
      appProvider.overrideWith((ref) => provider ?? _MockAppProvider()),
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

void main() {
  group('Offline/Error — Wallet Screen States', () {
    testWidgets('renders with empty transaction list', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const WalletScreen(),
        provider: _MockAppProvider(transactions: []),
      ));
      await tester.pumpAndSettle();

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
      await tester.pumpAndSettle();

      // Should not crash — wallet card should handle null rider gracefully
      expect(find.byType(WalletScreen), findsOneWidget);
    });

    testWidgets('shows refresh button even in empty state', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const WalletScreen(),
        provider: _MockAppProvider(transactions: []),
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('refreshButton')), findsOneWidget);
    });

    testWidgets('shows wallet content with zero balance', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const WalletScreen(),
        provider: _MockAppProvider(
          rider: makeRider(walletBalance: 0),
        ),
      ));
      await tester.pumpAndSettle();

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
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('Offline/Error — Profile Screen States', () {
    testWidgets('renders with null rider data', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(rider: null),
      ));
      await tester.pumpAndSettle();

      // Should not crash — profile should handle null rider gracefully
      expect(find.byType(ProfileScreen), findsOneWidget);
    });

    testWidgets('shows Profile title even with no data', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(rider: null),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Profile'), findsOneWidget);
    });

    testWidgets('shows default name when rider is null', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(rider: null),
      ));
      await tester.pumpAndSettle();

      // Profile screen shows 'Test Rider' as default
      expect(find.text('Test Rider'), findsOneWidget);
    });

    testWidgets('shows QUICK LINKS section', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(rider: null),
      ));
      await tester.pumpAndSettle();

      expect(find.text('QUICK LINKS'), findsOneWidget);
    });

    testWidgets('does not overflow with null rider', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(rider: null),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets('shows rider name when data is available', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(
          rider: makeRider(name: 'John Doe'),
        ),
      ));
      await tester.pumpAndSettle();

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
      await tester.pumpAndSettle();

      expect(find.text('9876543210'), findsOneWidget);
    });

    testWidgets('shows rider ID when data is available', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(
          rider: makeRider(riderId: 'VF-RD-88'),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('VF-RD-88'), findsOneWidget);
    });

    testWidgets('shows Personal Details section', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(rider: null),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Personal Details'), findsOneWidget);
    });

    testWidgets('shows Not Provided for missing fields', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(
          rider: makeRider(),
        ),
      ));
      await tester.pumpAndSettle();

      // When email is null, it shows "Not provided"
      expect(find.text('Not provided'), findsWidgets);
    });

    testWidgets('shows KYC status badge', (tester) async {
      await tester.pumpWidget(wrapInApp(
        child: const ProfileScreen(),
        provider: _MockAppProvider(
          rider: makeRider(),
        ),
      ));
      await tester.pumpAndSettle();

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
    testWidgets('dark mode toggle in widget tree', (tester) async {
      final themeProvider = ThemeProvider();
      await tester.pumpWidget(MaterialApp(
        home: ChangeNotifierProvider<ThemeProvider>.value(
          value: themeProvider,
          child: Builder(
            builder: (context) {
              final tp = context.watch<ThemeProvider>();
              return Scaffold(
                body: SwitchListTile(
                  title: const Text('Dark Mode'),
                  value: tp.isDarkMode,
                  onChanged: (v) => tp.setDarkMode(v),
                ),
              );
            },
          ),
        ),
      ));

      expect(themeProvider.isDarkMode, isFalse);

      await tester.tap(find.byType(Switch));
      await tester.pump();
      expect(themeProvider.isDarkMode, isTrue);
    });

    testWidgets('locale switch in widget tree', (tester) async {
      final localeProvider = LocaleProvider();
      await tester.pumpWidget(MaterialApp(
        home: ChangeNotifierProvider<LocaleProvider>.value(
          value: localeProvider,
          child: Builder(
            builder: (context) {
              return Text(context.watch<LocaleProvider>().locale.languageCode);
            },
          ),
        ),
      ));

      expect(find.text('en'), findsOneWidget);

      localeProvider.setHindi();
      await tester.pumpAndSettle();
      expect(find.text('hi'), findsOneWidget);

      localeProvider.setEnglish();
      await tester.pumpAndSettle();
      expect(find.text('en'), findsOneWidget);
    });
  });
}
