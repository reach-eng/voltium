import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/intent_of_use_screen.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/user_onboarding_screen.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/choose_plan_screen.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_flow.dart';
import 'package:voltium_rider/features/workflows/presentation/screens/rider_workflow_hub_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/widgets/lifecycle_route_guard.dart';

class _SeededRiderNotifier extends RiderNotifier {
  RiderModel? _seed;
  _SeededRiderNotifier(this._seed);

  @override
  RiderState build() => RiderState(
        rider: _seed,
        riderId: _seed?.riderId ?? '',
        phone: _seed?.phone ?? '',
        dataState: DataState.fresh,
        hasFetchedOnce: true,
      );

  void emitNewRider(RiderModel? newRider) {
    _seed = newRider;
    state = state.copyWith(rider: newRider);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await CacheService().init();
  });

  const activeRider = RiderModel(
    id: 'rider-1',
    riderId: 'rider-1',
    phone: '9876543210',
    name: 'Active Rider',
    lifecycleStatus: 'ACTIVE',
    accountStatus: AccountStatus.active,
  );

  const suspendedRider = RiderModel(
    id: 'rider-2',
    riderId: 'rider-2',
    phone: '9876543211',
    name: 'Suspended Rider',
    lifecycleStatus: 'SUSPENDED',
    accountStatus: AccountStatus.suspended,
  );

  const terminatedRider = RiderModel(
    id: 'rider-3',
    riderId: 'rider-3',
    phone: '9876543212',
    name: 'Terminated Rider',
    lifecycleStatus: 'CLOSED',
    accountStatus: AccountStatus.terminated,
  );

  Widget buildHubHarness({
    required _SeededRiderNotifier notifier,
  }) {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        riderProvider.overrideWith(() => notifier),
      ],
      child: const MaterialApp(
        localizationsDelegates: [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: RiderWorkflowHubScreen(),
      ),
    );
  }

  Widget buildFormHarness({
    required Widget child,
    required _SeededRiderNotifier notifier,
  }) {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        riderProvider.overrideWith(() => notifier),
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: Scaffold(
          body: Builder(
            builder: (ctx) => Center(
              child: ElevatedButton(
                onPressed: () {
                  Navigator.of(ctx).push(
                    MaterialPageRoute(builder: (_) => child),
                  );
                },
                child: const Text('Open Form Screen'),
              ),
            ),
          ),
        ),
      ),
    );
  }

  group('LifecycleRouteGuard (P1-1)', () {
    test('isLifecycleBlocked returns expected values', () {
      expect(isLifecycleBlocked(null), isFalse);
      expect(isLifecycleBlocked(activeRider), isFalse);
      expect(isLifecycleBlocked(suspendedRider), isTrue);
      expect(isLifecycleBlocked(terminatedRider), isTrue);
    });

    testWidgets('active rider taps hub tile -> pushes target screen',
        (tester) async {
      final notifier = _SeededRiderNotifier(activeRider);

      await tester.pumpWidget(buildHubHarness(notifier: notifier));
      await tester.pumpAndSettle();

      expect(find.byType(RiderWorkflowHubScreen), findsOneWidget);

      // Tap 'Intent of use' tile
      final tile = find.text('Intent of Use');
      expect(tile, findsOneWidget);
      await tester.tap(tile);
      await tester.pumpAndSettle();

      expect(find.byType(IntentOfUseScreen), findsOneWidget);
    });

    testWidgets('suspended rider taps hub tile -> toast shown, no push',
        (tester) async {
      final notifier = _SeededRiderNotifier(suspendedRider);

      await tester.pumpWidget(buildHubHarness(notifier: notifier));
      await tester.pumpAndSettle();

      final tile = find.text('Intent of Use');
      expect(tile, findsOneWidget);
      await tester.tap(tile);
      await tester.pumpAndSettle();

      // Screen should NOT have been pushed
      expect(find.byType(IntentOfUseScreen), findsNothing);
      expect(find.byType(RiderWorkflowHubScreen), findsOneWidget);
      // Toast message appears
      expect(
        find.textContaining(
            'Account unavailable. Your account is currently suspended'),
        findsOneWidget,
      );
    });

    testWidgets('terminated rider taps hub tile -> toast shown, no push',
        (tester) async {
      final notifier = _SeededRiderNotifier(terminatedRider);

      await tester.pumpWidget(buildHubHarness(notifier: notifier));
      await tester.pumpAndSettle();

      final tile = find.text('Intent of Use');
      expect(tile, findsOneWidget);
      await tester.tap(tile);
      await tester.pumpAndSettle();

      expect(find.byType(IntentOfUseScreen), findsNothing);
      expect(find.byType(RiderWorkflowHubScreen), findsOneWidget);
      expect(
        find.textContaining(
            'Account unavailable. Your account is currently suspended'),
        findsOneWidget,
      );
    });

    testWidgets(
        'UserOnboardingScreen pops automatically when rider becomes suspended',
        (tester) async {
      final notifier = _SeededRiderNotifier(activeRider);

      await tester.pumpWidget(buildFormHarness(
        child: const UserOnboardingScreen(),
        notifier: notifier,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open Form Screen'));
      await tester.pumpAndSettle();
      expect(find.byType(UserOnboardingScreen), findsOneWidget);

      // Suspend rider
      notifier.emitNewRider(suspendedRider);
      await tester.pumpAndSettle();

      expect(find.byType(UserOnboardingScreen), findsNothing);
      expect(find.text('Open Form Screen'), findsOneWidget);
    });

    testWidgets(
        'GuarantorOnboardingScreen pops automatically when rider becomes terminated',
        (tester) async {
      final notifier = _SeededRiderNotifier(activeRider);

      await tester.pumpWidget(buildFormHarness(
        child: const GuarantorOnboardingScreen(),
        notifier: notifier,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open Form Screen'));
      await tester.pumpAndSettle();
      expect(find.byType(GuarantorOnboardingScreen), findsOneWidget);

      // Terminate rider
      notifier.emitNewRider(terminatedRider);
      await tester.pumpAndSettle();

      expect(find.byType(GuarantorOnboardingScreen), findsNothing);
      expect(find.text('Open Form Screen'), findsOneWidget);
    });
  });

  group('Hub Forward Navigation Chaining (P1-2)', () {
    testWidgets(
        'onboarding rider taps Guarantor details -> can chain forward to ChoosePlan and TopUpFlow',
        (tester) async {
      final notifier = _SeededRiderNotifier(
        activeRider.copyWith(pickupDone: false),
      );

      await tester.pumpWidget(buildHubHarness(notifier: notifier));
      await tester.pumpAndSettle();

      // Tap 'Guarantor details' tile
      final guarantorTile = find.text('Guarantor details');
      expect(guarantorTile, findsOneWidget);
      await tester.tap(guarantorTile);
      await tester.pumpAndSettle();

      expect(find.byType(GuarantorOnboardingScreen), findsOneWidget);

      // Trigger onNext callback of GuarantorOnboardingScreen
      final guarantorScreen = tester.widget<GuarantorOnboardingScreen>(
        find.byType(GuarantorOnboardingScreen),
      );
      expect(guarantorScreen.onNext, isNotNull);
      guarantorScreen.onNext!();
      await tester.pumpAndSettle();

      expect(find.byType(ChoosePlanScreen), findsOneWidget);

      // Trigger onNext callback of ChoosePlanScreen
      final planScreen = tester.widget<ChoosePlanScreen>(
        find.byType(ChoosePlanScreen),
      );
      planScreen.onNext();
      await tester.pumpAndSettle();

      expect(find.byType(TopUpFlow), findsOneWidget);
    });

    testWidgets(
        'onboarding rider taps Choose plan -> onNext chains forward to TopUpFlow',
        (tester) async {
      final notifier = _SeededRiderNotifier(
        activeRider.copyWith(pickupDone: false),
      );

      await tester.pumpWidget(buildHubHarness(notifier: notifier));
      await tester.pumpAndSettle();

      // Tap 'Choose plan' tile
      final planTile = find.text('Choose plan');
      expect(planTile, findsOneWidget);
      await tester.tap(planTile);
      await tester.pumpAndSettle();

      expect(find.byType(ChoosePlanScreen), findsOneWidget);

      final planScreen = tester.widget<ChoosePlanScreen>(
        find.byType(ChoosePlanScreen),
      );
      planScreen.onNext();
      await tester.pumpAndSettle();

      expect(find.byType(TopUpFlow), findsOneWidget);
    });

    testWidgets(
        'post-onboarding rider (pickupDone=true) -> onNext pops instead of chaining forward',
        (tester) async {
      final notifier = _SeededRiderNotifier(
        activeRider.copyWith(pickupDone: true),
      );

      await tester.pumpWidget(buildHubHarness(notifier: notifier));
      await tester.pumpAndSettle();

      final guarantorTile = find.text('Guarantor details');
      await tester.tap(guarantorTile);
      await tester.pumpAndSettle();

      expect(find.byType(GuarantorOnboardingScreen), findsOneWidget);

      final guarantorScreen = tester.widget<GuarantorOnboardingScreen>(
        find.byType(GuarantorOnboardingScreen),
      );
      expect(guarantorScreen.onNext, isNotNull);
      guarantorScreen.onNext!();
      await tester.pumpAndSettle();

      // Screen popped back to hub
      expect(find.byType(GuarantorOnboardingScreen), findsNothing);
      expect(find.byType(RiderWorkflowHubScreen), findsOneWidget);
    });
  });
}
