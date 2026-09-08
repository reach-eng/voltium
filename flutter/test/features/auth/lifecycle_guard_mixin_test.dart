import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/auth/presentation/lifecycle_guard_mixin.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/choose_plan_screen.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_flow.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/theme/theme_provider.dart';

class _SeededRiderNotifier extends RiderNotifier {
  RiderModel _seed;
  _SeededRiderNotifier(this._seed);

  @override
  RiderState build() => RiderState(
        rider: _seed,
        riderId: _seed.riderId.isNotEmpty ? _seed.riderId : _seed.id,
        phone: _seed.phone,
        dataState: DataState.fresh,
        hasFetchedOnce: true,
      );

  void emitNewRider(RiderModel newRider) {
    _seed = newRider;
    state = state.copyWith(rider: newRider);
  }
}

class _TestGuardScreen extends ConsumerStatefulWidget {
  const _TestGuardScreen();

  @override
  ConsumerState<_TestGuardScreen> createState() => _TestGuardScreenState();
}

class _TestGuardScreenState extends ConsumerState<_TestGuardScreen>
    with LifecycleGuardMixin {
  @override
  Widget build(BuildContext context) {
    registerLifecycleGuard();
    return const Scaffold(
      body: Center(child: Text('Test Guard Screen Active')),
    );
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

  Widget buildHarness({
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
                child: const Text('Open Target Screen'),
              ),
            ),
          ),
        ),
      ),
    );
  }

  group('LifecycleGuardMixin (P1-1)', () {
    testWidgets('screen with LifecycleGuardMixin pops on rider suspension',
        (tester) async {
      final notifier = _SeededRiderNotifier(activeRider);

      await tester.pumpWidget(buildHarness(
        child: const _TestGuardScreen(),
        notifier: notifier,
      ));
      await tester.pumpAndSettle();

      // Open target screen
      await tester.tap(find.text('Open Target Screen'));
      await tester.pumpAndSettle();
      expect(find.text('Test Guard Screen Active'), findsOneWidget);

      // Normal update does not pop
      notifier.emitNewRider(activeRider.copyWith(
        name: 'Updated Name',
        updatedAt: DateTime.now(),
      ));
      await tester.pumpAndSettle();
      expect(find.text('Test Guard Screen Active'), findsOneWidget);

      // Suspension causes automatic pop
      notifier.emitNewRider(activeRider.copyWith(
        accountStatus: AccountStatus.suspended,
        lifecycleStatus: 'SUSPENDED',
        updatedAt: DateTime.now(),
      ));
      await tester.pumpAndSettle();

      // Target screen popped; underlying button is visible again
      expect(find.text('Test Guard Screen Active'), findsNothing);
      expect(find.text('Open Target Screen'), findsOneWidget);
    });

    testWidgets('screen with LifecycleGuardMixin pops on rider termination',
        (tester) async {
      final notifier = _SeededRiderNotifier(activeRider);

      await tester.pumpWidget(buildHarness(
        child: const _TestGuardScreen(),
        notifier: notifier,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open Target Screen'));
      await tester.pumpAndSettle();
      expect(find.text('Test Guard Screen Active'), findsOneWidget);

      // Termination triggers pop
      notifier.emitNewRider(activeRider.copyWith(
        accountStatus: AccountStatus.terminated,
        lifecycleStatus: 'CLOSED',
        updatedAt: DateTime.now(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Test Guard Screen Active'), findsNothing);
      expect(find.text('Open Target Screen'), findsOneWidget);
    });

    testWidgets(
        'ChoosePlanScreen pops automatically when rider becomes suspended',
        (tester) async {
      final notifier = _SeededRiderNotifier(activeRider);

      await tester.pumpWidget(buildHarness(
        child: ChoosePlanScreen(onNext: () {}),
        notifier: notifier,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open Target Screen'));
      await tester.pumpAndSettle();
      expect(find.byType(ChoosePlanScreen), findsOneWidget);

      // Suspend rider
      notifier.emitNewRider(activeRider.copyWith(
        accountStatus: AccountStatus.suspended,
        lifecycleStatus: 'SUSPENDED',
        updatedAt: DateTime.now(),
      ));
      await tester.pumpAndSettle();

      expect(find.byType(ChoosePlanScreen), findsNothing);
      expect(find.text('Open Target Screen'), findsOneWidget);
    });

    testWidgets('TopUpFlow pops automatically when rider becomes terminated',
        (tester) async {
      final notifier = _SeededRiderNotifier(activeRider);

      await tester.pumpWidget(buildHarness(
        child: const TopUpFlow(),
        notifier: notifier,
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Open Target Screen'));
      await tester.pumpAndSettle();
      expect(find.byType(TopUpFlow), findsOneWidget);

      // Terminate rider
      notifier.emitNewRider(activeRider.copyWith(
        accountStatus: AccountStatus.terminated,
        lifecycleStatus: 'CLOSED',
        updatedAt: DateTime.now(),
      ));
      await tester.pumpAndSettle();

      expect(find.byType(TopUpFlow), findsNothing);
      expect(find.text('Open Target Screen'), findsOneWidget);
    });
  });
}
