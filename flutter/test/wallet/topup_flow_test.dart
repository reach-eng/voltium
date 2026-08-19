import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_flow.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_amount_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

class _SeededRiderNotifier extends RiderNotifier {
  final RiderModel _seed;
  _SeededRiderNotifier(this._seed);

  @override
  RiderState build() => RiderState(
        rider: _seed,
        riderId: _seed.riderId.isNotEmpty ? _seed.riderId : _seed.id,
        phone: _seed.phone,
        dataState: DataState.fresh,
        hasFetchedOnce: true,
      );
}

/// Top-up Flow Widget Tests
void main() {
  Widget buildTestApp({
    required Widget child,
    RiderModel? rider,
    ThemeMode themeMode = ThemeMode.light,
  }) {
    final seedRider = rider ??
        const RiderModel(
          id: 'test_rider_1',
          riderId: 'R-01',
          name: 'Test Rider',
          phone: '+919876543210',
          walletBalance: 500,
        );

    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        appProvider.overrideWith((ref) => AppProvider()),
        riderProvider.overrideWith(() => _SeededRiderNotifier(seedRider)),
      ],
      child: MaterialApp(
        themeMode: themeMode,
        theme: ThemeData.light(),
        darkTheme: ThemeData.dark(),
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

  group('Top-up Amount Screen', () {
    testWidgets('amount screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const TopUpAmountScreen()));
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(TopUpAmountScreen), findsOneWidget);
    });

    testWidgets('amount screen has an amount input field', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const TopUpAmountScreen()));
      await tester.pump(const Duration(seconds: 1));

      // Should have a numeric input for amount
      final hasTextField = find.byType(TextField).evaluate().isNotEmpty;
      expect(hasTextField, isTrue);
    });

    testWidgets('displays deposit breakdown when securityDeposit and rentalPrice are provided',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      const rider = RiderModel(
        id: 'r1',
        riderId: 'R-01',
        name: 'Rider One',
        phone: '+919988776655',
        advanceRentPaid: true,
        currentPlanSecurityDepositInRupees: 2000,
        currentPlanPrice: 1500,
      );

      await tester.pumpWidget(buildTestApp(
        child: const TopUpAmountScreen(
          securityDeposit: 2000,
          rentalPrice: 1500,
        ),
        rider: rider,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Required Deposit Breakdown'), findsOneWidget);
      expect(find.text('Security Deposit'), findsOneWidget);
      expect(find.text('Advance Rental Plan Fee'), findsOneWidget);
      expect(find.text('Minimum Required Top-Up'), findsOneWidget);
      expect(find.text('₹3500'), findsAtLeastNWidgets(1));
    });

    testWidgets('quick chips allow selecting amounts and invoking onProceed',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      int? proceededAmount;
      await tester.pumpWidget(buildTestApp(
        child: TopUpAmountScreen(
          securityDeposit: 1000,
          onProceed: (amt) => proceededAmount = amt,
        ),
      ));
      await tester.pumpAndSettle();

      // Tap on quick chip for ₹2000
      final chip2000 = find.text('₹2000');
      if (chip2000.evaluate().isNotEmpty) {
        await tester.tap(chip2000);
        await tester.pumpAndSettle();
      }

      final proceedBtn = find.byKey(const Key('proceedToPaymentButton'));
      expect(proceedBtn, findsOneWidget);
      await tester.tap(proceedBtn);
      await tester.pumpAndSettle();

      expect(proceededAmount, isNotNull);
      expect(proceededAmount! >= 1000, isTrue);
    });

    testWidgets('renders cleanly in dark mode without throwing', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(
        child: const TopUpAmountScreen(securityDeposit: 2000),
        themeMode: ThemeMode.dark,
      ));
      await tester.pumpAndSettle();

      expect(find.byType(TopUpAmountScreen), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
