import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/guarantor/data/skip_deposit_config.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_amount_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/cache_service.dart';
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
  group('TopUpAmountScreen Higher Deposit Tests', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
    });

    Widget buildScreen({
      required RiderModel rider,
      int? securityDeposit,
      int? rentalPrice,
      Function(int)? onProceed,
    }) {
      return ProviderScope(
        overrides: [
          riderProvider.overrideWith(() => _SeededRiderNotifier(rider)),
          skipDepositConfigProvider.overrideWith((ref) async {
            return const SkipDepositConfig(
              extraDepositRupees: 1000,
              source: SkipDepositSource.admin,
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
          theme: AppTheme.lightTheme,
          home: Scaffold(
            body: TopUpAmountScreen(
              securityDeposit: securityDeposit,
              rentalPrice: rentalPrice,
              onProceed: onProceed,
            ),
          ),
        ),
      );
    }

    testWidgets(
        'Rider with requiresHigherDeposit: true sees extra deposit line in breakdown card and higher minimum',
        (tester) async {
      const rider = RiderModel(
        id: 'rider_higher_topup',
        riderId: 'rider_higher_topup',
        name: 'Higher Topup Rider',
        phone: '9999999999',
        lifecycleStatus: 'NEW',
        requiresHigherDeposit: true,
      );

      await tester.pumpWidget(buildScreen(
        rider: rider,
        securityDeposit: 1000,
        rentalPrice: 500,
      ));
      await tester.pumpAndSettle();

      // Breakdown card contains the extra deposit row
      expect(
        find.byKey(const Key('skipGuarantorExtraDepositRow')),
        findsOneWidget,
      );
      expect(
        find.text('Extra Deposit (Skipped Guarantor)'),
        findsOneWidget,
      );
      expect(find.text('₹1000'), findsWidgets);

      // Auto-filled amount in text field must be at least 2000 (1000 base deposit + 1000 extra deposit)
      expect(find.text('2000'), findsWidgets);
    });

    testWidgets(
        'Rider with requiresHigherDeposit: false does not see extra deposit row',
        (tester) async {
      const rider = RiderModel(
        id: 'rider_normal_topup',
        riderId: 'rider_normal_topup',
        name: 'Normal Topup Rider',
        phone: '9999999999',
        lifecycleStatus: 'NEW',
        requiresHigherDeposit: false,
      );

      await tester.pumpWidget(buildScreen(
        rider: rider,
        securityDeposit: 1000,
        rentalPrice: 500,
      ));
      await tester.pumpAndSettle();

      // Breakdown card does NOT contain the extra deposit row
      expect(
        find.byKey(const Key('skipGuarantorExtraDepositRow')),
        findsNothing,
      );
      expect(
        find.text('Extra Deposit (Skipped Guarantor)'),
        findsNothing,
      );

      // Auto-filled amount in text field is base deposit 1000
      expect(find.text('1000'), findsWidgets);
    });
  });
}
