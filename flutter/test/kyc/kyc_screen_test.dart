import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/user_onboarding_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
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

    testWidgets(
        'renders Step 1 Personal Details fields and pre-fills rider name/phone',
        (tester) async {
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

    testWidgets('does not advance to Step 2 when Step 1 form is empty',
        (tester) async {
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

      // PR-1 (F-001): the previous version of this test set
      // `AppConstants.isTestModeOverride = true` to bypass the
      // form-completeness check. That bypass is gone (release-build
      // hardened). The new test verifies the actual production
      // behavior: an empty form does NOT advance to Step 2.
      //
      // Advancing to Step 2 requires the date picker + Aadhaar + PAN
      // + selfie + signature + bank details to be populated, which
      // is covered by the integration test harness (which builds
      // with `--dart-define=KYC_TEST_AUTOFILL=true` to skip the
      // photo + signature capture and provides a date-picker helper).
      final nextButton = find.byKey(const Key('nextOnboardingButton'));
      await tester.ensureVisible(nextButton);
      await tester.pumpAndSettle();
      await tester.tap(nextButton);
      await tester.pumpAndSettle();

      // Step 1 form is empty → screen does NOT advance to Step 2.
      // Step 2's first widget is the Aadhaar upload tile; if it
      // appeared, the form-completeness check is broken.
      expect(
        find.byKey(const Key('aadhaarFrontTile')),
        findsNothing,
        reason: 'must not advance to Step 2 with an empty form',
      );
      // The Step 1 "Next" button is still on the page.
      expect(
        find.byKey(const Key('nextOnboardingButton')),
        findsOneWidget,
        reason: 'must still be on Step 1',
      );
    });

    testWidgets('renders cleanly in dark mode without throwing',
        (tester) async {
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
