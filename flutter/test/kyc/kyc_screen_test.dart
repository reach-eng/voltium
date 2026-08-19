import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/user_onboarding_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/utils/app_constants.dart';
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

/// KYC Screen Widget Tests
void main() {
  Widget buildTestApp({
    required Widget child,
    RiderModel? rider,
    ThemeMode themeMode = ThemeMode.light,
  }) {
    final seedRider = rider ??
        const RiderModel(
          id: 'test_rider_123',
          riderId: 'test_rider_123',
          name: 'Test Rider',
          phone: '+919876543210',
          lifecycleStatus: 'NEW',
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

  group('KYC / Onboarding Screen', () {
    testWidgets('onboarding screen renders without error', (tester) async {
      await tester
          .pumpWidget(buildTestApp(child: const UserOnboardingScreen()));
      await tester.pump(const Duration(seconds: 1));

      expect(find.byType(UserOnboardingScreen), findsOneWidget);
    });

    testWidgets('onboarding screen has a next/continue button or form field',
        (tester) async {
      await tester
          .pumpWidget(buildTestApp(child: const UserOnboardingScreen()));
      await tester.pump(const Duration(seconds: 1));

      // At least a text input or button should be visible
      final hasTextField = find.byType(TextField).evaluate().isNotEmpty;
      final hasButton = find.byType(ElevatedButton).evaluate().isNotEmpty;
      final hasTextButton = find.byType(TextButton).evaluate().isNotEmpty;

      expect(hasTextField || hasButton || hasTextButton, isTrue);
    });

    testWidgets('onboarding screen does not overflow', (tester) async {
      await tester
          .pumpWidget(buildTestApp(child: const UserOnboardingScreen()));
      await tester.pump(const Duration(seconds: 1));

      // Should render without RenderFlex overflow errors
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders Step 1 Personal Details fields and pre-fills rider name/phone', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      const rider = RiderModel(
        id: 'rider_99',
        riderId: 'R-99',
        name: 'Siddharth Rao',
        phone: '+919988776655',
        lifecycleStatus: 'NEW',
      );

      await tester.pumpWidget(buildTestApp(
        child: const UserOnboardingScreen(),
        rider: rider,
      ));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('fullNameField')), findsOneWidget);
      expect(find.byKey(const Key('dobField')), findsOneWidget);
      expect(find.byKey(const Key('emailField')), findsOneWidget);
      expect(find.text('+91 99887 76655'), findsOneWidget);
      expect(find.byKey(const Key('fatherNameField')), findsOneWidget);
      expect(find.byKey(const Key('motherNameField')), findsOneWidget);
      expect(find.byKey(const Key('nextOnboardingButton')), findsOneWidget);
    });

    testWidgets('advances to Step 2 and opens Bank Details dialog', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      AppConstants.isTestModeOverride = true;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
        AppConstants.isTestModeOverride = false;
      });

      await tester.pumpWidget(buildTestApp(child: const UserOnboardingScreen()));
      await tester.pumpAndSettle();

      // In test mode, _canProceedCurrentStep is true, click Confirm & Proceed
      final nextButton = find.byKey(const Key('nextOnboardingButton'));
      await tester.tap(nextButton);
      await tester.pumpAndSettle();

      // Should now be on Step 2 (Identity & Bank Verification)
      expect(find.byKey(const Key('aadhaarFrontTile')), findsOneWidget);
      expect(find.byKey(const Key('aadhaarBackTile')), findsOneWidget);
      expect(find.byKey(const Key('panTile')), findsOneWidget);
      expect(find.byKey(const Key('bankTile')), findsOneWidget);

      // Open Bank details dialog
      await tester.tap(find.byKey(const Key('bankTile')));
      await tester.pumpAndSettle();

      expect(find.text('Bank Details'), findsOneWidget);
      expect(find.text('Bank Name'), findsOneWidget);
      expect(find.text('Account Number'), findsOneWidget);
      expect(find.text('IFSC Code'), findsOneWidget);

      // Tap Save
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
    });

    testWidgets('renders cleanly in dark mode without throwing', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(
        child: const UserOnboardingScreen(),
        themeMode: ThemeMode.dark,
      ));
      await tester.pumpAndSettle();

      expect(find.byType(UserOnboardingScreen), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
