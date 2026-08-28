import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
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

void main() {
  Widget buildTestHost({
    Function(int)? onProceed,
    VoidCallback? onBack,
    int? initialAmount,
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
  });
}
