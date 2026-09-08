import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_amount_screen.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

class _SeededRiderNotifier extends RiderNotifier {
  _SeededRiderNotifier(this._seed);
  final RiderModel _seed;

  @override
  RiderState build() => RiderState(
        rider: _seed,
        riderId: _seed.riderId.isNotEmpty ? _seed.riderId : _seed.id,
        phone: _seed.phone,
        dataState: DataState.fresh,
        hasFetchedOnce: true,
      );
}

// P0-4 (2026-09-07) Gap 8: the screen's _requiredMinAmount getter reads
// `walletProvider.walletMinTopup` (set by `loadSettings()` from
// GET /api/rider/settings). To exercise the screen-level render — not
// just the provider state — we seed the wallet notifier with a
// specific `walletMinTopup` value. The `build()` override returns the
// desired state directly so the screen reflects it on the first frame
// (the post-frame `loadSettings()` callback in `initState` will fail
// silently without an API client override, but the seeded state is
// already in place).
class _SeededWalletNotifier extends WalletNotifier {
  _SeededWalletNotifier(this._min);
  final double _min;

  @override
  WalletState build() => WalletState(walletMinTopup: _min);
}

void main() {
  Widget buildTestHost({
    Function(int)? onProceed,
    VoidCallback? onBack,
    int? initialAmount,
    double walletMinTopup = 0.0,
  }) {
    return ProviderScope(
      overrides: [
        riderProvider.overrideWith(() => _SeededRiderNotifier(
              const RiderModel(
                id: 'rider_123',
                riderId: 'rider_123',
                name: 'Test Rider',
                phone: '9999999999',
                lifecycleStatus: 'ACTIVE',
              ),
            )),
        walletProvider
            .overrideWith(() => _SeededWalletNotifier(walletMinTopup)),
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en'), Locale('hi')],
        theme: AppTheme.lightTheme,
        home: TopUpAmountScreen(
          onProceed: onProceed,
          onBack: onBack,
          initialAmount: initialAmount ?? 1000,
        ),
      ),
    );
  }

  group('TopUpAmountScreen Tests', () {
    testWidgets('renders initial amount in text field and quick amount chips',
        (tester) async {
      await tester.pumpWidget(buildTestHost(initialAmount: 1500));
      await tester.pumpAndSettle();

      expect(find.text('1500'), findsWidgets);
      // PR-C (2026-08-28): the production screen switched to
      // TextFormField (inside the new VoltiumTextField-ish input).
      // find.byType(TextField) would now match zero widgets.
      expect(find.byType(TextFormField), findsOneWidget);
    });

    testWidgets('invokes onBack when back button is pressed', (tester) async {
      bool backCalled = false;
      await tester.pumpWidget(buildTestHost(onBack: () => backCalled = true));
      await tester.pumpAndSettle();

      final backButton = find.byKey(const Key('backButton'));
      expect(backButton, findsOneWidget);
      await tester.tap(backButton);
      await tester.pumpAndSettle();

      expect(backCalled, isTrue);
    });

    testWidgets('invokes onProceed with selected amount when proceed is tapped',
        (tester) async {
      int? proceededAmount;
      await tester.pumpWidget(buildTestHost(
        initialAmount: 2000,
        onProceed: (amount) => proceededAmount = amount,
      ));
      await tester.pumpAndSettle();

      // PR-D: verify the CTA label is sentence-case, NOT all-caps
      expect(find.text('PROCEED TO PAYMENT'), findsNothing);
      expect(find.text('Proceed to payment'), findsOneWidget);

      // Tap by widget key (GestureDetector key set in the screen)
      final proceedButton = find.byKey(const Key('proceedToPaymentButton'));
      expect(proceedButton, findsOneWidget);

      await tester.tap(proceedButton);
      await tester.pumpAndSettle();

      expect(proceededAmount, equals(2000));
    });

    // P0-4 (2026-09-07) Gap 8: the screen's `_requiredMinAmount` getter
    // (top_up_amount_screen.dart:153-195) returns:
    //   * `planTotal` if `widget.securityDeposit + widget.rentalPrice > 0`
    //   * else `walletMinTopup` if the provider has a positive value
    //   * else `AppConstants.minTopUpAmount` (₹100) as the compile-time
    //     fallback for first launch / offline / endpoint failure
    //
    // The provider-level test (`test/providers/wallet_provider_test.dart`
    // P0-4 group) pins the data flow into `state.walletMinTopup`. These
    // two widget tests pin the *rendered* floor — the inline error
    // "Minimum ₹X required" that the Proceed button's enable/disable
    // depends on. A regression that drops `ref.watch` in `_canProceed`
    // or changes the fallback constant would fail here.
    testWidgets(
        'P0-4 floor: renders "Minimum ₹1500 required" when server walletMinTopup is 1500',
        (tester) async {
      // Rider has no active plan → securityDeposit = 0, rentalPrice = 0
      // → planTotal = 0 → _requiredMinAmount = effectiveMin = 1500.
      // initialAmount 500 sits below the 1500 floor, so the inline
      // error must show.
      await tester.pumpWidget(buildTestHost(
        initialAmount: 500,
        walletMinTopup: 1500.0,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Minimum ₹1500 required'), findsOneWidget);
    });

    testWidgets(
        'P0-4 floor: falls back to AppConstants.minTopUpAmount (₹100) when server is 0',
        (tester) async {
      // walletMinTopup: 0 → effectiveMin = AppConstants.minTopUpAmount
      // (100). initialAmount 50 sits below the 100 floor, so the
      // inline error must show "Minimum ₹100 required".
      await tester.pumpWidget(buildTestHost(
        initialAmount: 50,
        walletMinTopup: 0.0,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Minimum ₹100 required'), findsOneWidget);
    });
  });
}
