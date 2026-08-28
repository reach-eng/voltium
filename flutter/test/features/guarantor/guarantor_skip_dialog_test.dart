import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';
import 'package:voltium_rider/features/guarantor/data/skip_deposit_config.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

/// PR-GUARANTOR-SKIP (2026-08-28): the "Skip" action on the guarantor
/// form is back. A rider who doesn't have a guarantor can opt to pay
/// a higher security deposit instead. The amount is admin-managed from
/// the admin panel's Configurations section and served via
/// `skipDepositConfigProvider`. The dialog shows the amount and a
/// "configured by Voltium" / "default" sub-label.
void main() {
  // Seeds a fresh RiderNotifier so the screen has a riderId to write
  // the higher-deposit flag against. Without this the screen's
  // `riderId` would be null and the persistence would no-op.
  Widget buildScreen({
    VoidCallback? onNext,
    String riderId = 'test_rider_skip_dialog',
  }) {
    return ProviderScope(
      overrides: [
        riderProvider.overrideWith(() => _SeededRiderNotifier(
              RiderModel(
                id: riderId,
                riderId: riderId,
                name: 'Test Rider',
                phone: '9999999999',
                lifecycleStatus: 'NEW',
              ),
            )),
        skipDepositConfigProvider.overrideWith((ref) async {
          return const SkipDepositConfig(
            extraDepositRupees: 1000,
            source: SkipDepositSource.fallback,
          );
        }),
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en'), Locale('hi')],
        home: GuarantorOnboardingScreen(onNext: onNext ?? () {}),
      ),
    );
  }

  testWidgets('renders the guarantor form', (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 300));
    // 'Guarantor Details' is rendered both in the section title and
    // the step header — assert at-least-one rather than exactly-one.
    expect(find.text('Guarantor Details'), findsAtLeastNWidgets(1));
    expect(tester.takeException(), isNull);
  });

  testWidgets('skip opens a dialog that states the higher-deposit amount',
      (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.byKey(const Key('skipGuarantorButton')));
    await tester.pump(const Duration(seconds: 1));

    expect(find.byKey(const Key('skipGuarantorDialog')), findsOneWidget);
    expect(find.text('Skip guarantor?'), findsOneWidget);
    expect(find.textContaining('₹1,000'), findsOneWidget);
    expect(find.byKey(const Key('skipGuarantorCancelButton')), findsOneWidget);
    expect(find.byKey(const Key('skipGuarantorConfirmButton')), findsOneWidget);
  });

  testWidgets('confirming skip calls onNext', (tester) async {
    var onNextCalled = false;
    await tester.pumpWidget(buildScreen(onNext: () {
      onNextCalled = true;
    }));
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.byKey(const Key('skipGuarantorButton')));
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.byKey(const Key('skipGuarantorConfirmButton')));
    await tester.pump(const Duration(seconds: 1));

    expect(onNextCalled, isTrue);
  });

  testWidgets('cancelling the skip dialog does not proceed', (tester) async {
    var onNextCalled = false;
    await tester.pumpWidget(buildScreen(onNext: () {
      onNextCalled = true;
    }));
    await tester.pump(const Duration(seconds: 1));

    await tester.tap(find.byKey(const Key('skipGuarantorButton')));
    await tester.pump(const Duration(seconds: 1));
    await tester.tap(find.byKey(const Key('skipGuarantorCancelButton')));
    await tester.pump(const Duration(seconds: 1));

    expect(onNextCalled, isFalse);
  });
}

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
