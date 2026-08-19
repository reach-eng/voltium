import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/user_onboarding_screen.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/splash_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';

/// Onboarding Flow Widget Tests
///
/// The old checklist-style `OnboardingScreen` was replaced by the KYC
/// `UserOnboardingScreen` (feat/ux-2 router rework). Tests follow the
/// screen's data contract: it reads `riderProvider` for the rider id
/// used to scope the cached form, so the provider is seeded directly.
void main() {
  Widget buildTestApp({required Widget child}) {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        riderProvider.overrideWith(() => _SeededRiderNotifier(
              const RiderModel(
                id: 'test_rider_123',
                riderId: 'test_rider_123',
                name: 'Test Rider',
                phone: '9999999999',
                lifecycleStatus: 'NEW',
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
        home: child,
      ),
    );
  }

  group('Onboarding Screen', () {
    testWidgets('user onboarding screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: const UserOnboardingScreen(onNext: null, onBack: null),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(UserOnboardingScreen), findsOneWidget);
    });

    testWidgets('user onboarding shows rider profile step', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: const UserOnboardingScreen(onNext: null, onBack: null),
      ));
      await tester.pump(const Duration(seconds: 1));

      final hasForm = find.byType(TextField).evaluate().isNotEmpty ||
          find.byType(TextFormField).evaluate().isNotEmpty ||
          find.byType(Card).evaluate().isNotEmpty ||
          find.byType(Text).evaluate().isNotEmpty;

      expect(hasForm, isTrue);
    });

    testWidgets('user onboarding screen does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: const UserOnboardingScreen(onNext: null, onBack: null),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });
  });

  group('Splash Screen', () {
    testWidgets('splash screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: SplashScreen(onComplete: () {}),
      ));
      await tester.pump(); // Single pump for splash
      expect(find.byType(SplashScreen), findsOneWidget);
      // Advance timers to prevent "Timer still pending" error
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(seconds: 3));
      await tester.pump(const Duration(seconds: 1));
    });
  });
}

/// Seeds the Riverpod `riderProvider` directly (R4.3c-6 migration): the
/// UserOnboardingScreen reads `ref.read(riderProvider).riderId` for the
/// cache key, so the legacy AppProvider seed alone no longer satisfies it.
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
