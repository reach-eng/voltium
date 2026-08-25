import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_amount_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';

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
    int? lockedAmount,
    RiderModel? rider,
  }) {
    return ProviderScope(
      overrides: [
        riderProvider.overrideWith(() => _SeededRiderNotifier(
              rider ??
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
        theme: AppTheme.lightTheme,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en'), Locale('hi')],
        home: TopUpAmountScreen(
          onProceed: onProceed,
          onBack: onBack,
          initialAmount: initialAmount ?? 1000,
          lockedAmount: lockedAmount,
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
      expect(find.byType(TextField), findsOneWidget);
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

      // Tap the Proceed / Top Up button
      final proceedButton = find.byKey(const Key('proceedToPaymentButton'));
      expect(proceedButton, findsOneWidget);

      await tester.tap(proceedButton);
      await tester.pumpAndSettle();

      expect(proceededAmount, equals(2000));
    });

    testWidgets(
        'renders locked amount with read-only text field and hides quick chips',
        (tester) async {
      int? proceededAmount;
      await tester.pumpWidget(buildTestHost(
        lockedAmount: 3400,
        onProceed: (amount) => proceededAmount = amount,
        rider: const RiderModel(
          id: 'rider_123',
          riderId: 'rider_123',
          name: 'Test Rider',
          phone: '9999999999',
          lifecycleStatus: 'PLAN_SELECTED',
          currentPlan: 'Weekly',
          currentPlanPrice: 1400.0,
          currentPlanSecurityDepositInRupees: 2000.0,
          advanceRentPaid: true,
        ),
      ));
      await tester.pumpAndSettle();

      // 3400 should be present
      expect(find.text('3400'), findsWidgets);
      expect(
          find.text('Fixed amount for initial plan deposit'), findsOneWidget);
      expect(find.text('Fixed Deposit: ₹3400'), findsOneWidget);

      // Verify TextField is read-only
      final textField = tester.widget<TextField>(find.byType(TextField));
      expect(textField.readOnly, isTrue);

      // Proceed button should proceed with locked amount
      final proceedButton = find.byKey(const Key('proceedToPaymentButton'));
      expect(proceedButton, findsOneWidget);
      await tester.tap(proceedButton);
      await tester.pumpAndSettle();

      expect(proceededAmount, equals(3400));
    });
  });
}
