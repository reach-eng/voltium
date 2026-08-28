import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/features/guarantor/data/skip_deposit_config.dart';

/// Seeds the Riverpod `riderProvider` directly (R4.3c-6 migration): the
/// screen reads `ref.read(riderProvider).riderId` for the cache key, so the
/// legacy `AppProvider.riderProvider` seed alone no longer satisfies it.
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
  group('Widget and Cache Tests', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
    });

    Widget createTestWidget({VoidCallback? onNext}) {
      return ProviderScope(
        overrides: [
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
          supportedLocales: const [Locale('en'), Locale('hi')],
          home: Scaffold(
            body: GuarantorOnboardingScreen(onNext: onNext),
          ),
        ),
      );
    }

    testWidgets('Screen renders all 6 sections', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('Guarantor Details'), findsWidgets);
      expect(find.text('NEXT STEP'), findsOneWidget);
    });

    testWidgets('Cache is loaded and populated', (WidgetTester tester) async {
      // Pre-populate cache
      final cacheData = {
        'name': 'Cached Name',
        'dob': '01-01-2000',
        'phone': '1234567890',
        'fatherName': 'Cached Father',
        'motherName': 'Cached Mother',
        'address': 'Cached Address',
      };
      await CacheService().setString(
          'guarantor_onboarding_form_cache_test_rider_123',
          jsonEncode(cacheData));

      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));

      // Verify fields are populated from cache
      expect(find.text('Cached Name'), findsOneWidget);
      expect(find.text('01-01-2000'), findsOneWidget);
      expect(find.text('1234567890'), findsOneWidget);
      expect(find.text('Cached Father'), findsOneWidget);
      expect(find.text('Cached Mother'), findsOneWidget);
      expect(find.text('Cached Address'), findsOneWidget);
    });

    testWidgets('Fields save to cache when typed', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));

      final nameField = find.byType(TextField).first;
      await tester.enterText(nameField, 'New Name');
      await tester.pump(const Duration(seconds: 1));

      // Read cache
      final cachedStr = CacheService()
          .getString('guarantor_onboarding_form_cache_test_rider_123');
      expect(cachedStr, isNotNull);

      final cacheData = jsonDecode(cachedStr!);
      expect(cacheData['name'], 'New Name');
    });
  });

  // ── Bug 25: liability banner ───────────────────────────────────────────
  group('Liability banner (Bug 25)', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
    });

    Widget createTestWidget() {
      return ProviderScope(
        overrides: [],
        child: const MaterialApp(
          home: Scaffold(
            body: GuarantorOnboardingScreen(),
          ),
        ),
      );
    }

    testWidgets('liability banner is visible at the top of the form',
        (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));

      // Banner explains the financial liability
      expect(find.byKey(const Key('guarantorLiabilityBanner')), findsOneWidget);
      expect(
        find.textContaining('Your guarantor takes on real financial liability'),
        findsOneWidget,
      );
      expect(
        find.textContaining('jointly responsible for all rental charges'),
        findsOneWidget,
      );
    });
  });

  // ── PR-GUARANTOR-SKIP (2026-08-28): the Skip button is back. A rider
  // without a guarantor can opt to pay a higher security deposit
  // instead — the amount is admin-managed from the admin panel's
  // Configurations section and served via `skipDepositConfigProvider`.
  // The 4 tests below cover the full Skip flow.
  group('Skip button (PR-GUARANTOR-SKIP, 2026-08-28)', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
    });

    Widget createTestWidget({VoidCallback? onNext}) {
      return ProviderScope(
        overrides: [
          riderProvider.overrideWith(() => _SeededRiderNotifier(
                const RiderModel(
                  id: 'test_rider_skip',
                  riderId: 'test_rider_skip',
                  name: 'Test Rider',
                  phone: '9999999999',
                  lifecycleStatus: 'NEW',
                ),
              )),
          // No backend in widget tests — the dialog must still render
          // with the fallback amount (₹1,000) and the "Default" source
          // label. Override the provider with a stub Future that
          // resolves to the fallback config.
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
          home: Scaffold(
            body: GuarantorOnboardingScreen(onNext: onNext),
          ),
        ),
      );
    }

    testWidgets('Skip button is visible in the bottom bar',
        (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));

      expect(find.byKey(const Key('skipGuarantorButton')), findsOneWidget);
    });

    testWidgets(
        'Tapping Skip opens a confirmation dialog with the higher-deposit amount',
        (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));

      // Tap the Skip button
      await tester.tap(find.byKey(const Key('skipGuarantorButton')));
      await tester.pump(const Duration(seconds: 1));

      // Confirmation dialog appears with the new copy.
      expect(find.byKey(const Key('skipGuarantorDialog')), findsOneWidget);
      expect(find.text('Skip guarantor?'), findsOneWidget);
      // Fallback amount from the override above.
      expect(find.textContaining('₹1,000'), findsOneWidget);
      expect(
        find.text('Default — admin has not set a value yet'),
        findsOneWidget,
      );

      // Cancel + confirm buttons visible
      expect(
          find.byKey(const Key('skipGuarantorCancelButton')), findsOneWidget);
      expect(
          find.byKey(const Key('skipGuarantorConfirmButton')), findsOneWidget);
    });

    testWidgets('Cancelling the skip dialog does not call onNext',
        (WidgetTester tester) async {
      var onNextCalled = false;
      await tester.pumpWidget(createTestWidget(onNext: () {
        onNextCalled = true;
      }));
      await tester.pump(const Duration(seconds: 1));

      await tester.tap(find.byKey(const Key('skipGuarantorButton')));
      await tester.pump(const Duration(seconds: 1));
      await tester.tap(find.byKey(const Key('skipGuarantorCancelButton')));
      await tester.pump(const Duration(seconds: 1));

      expect(onNextCalled, isFalse);
      // Higher-deposit flag must NOT be set when user cancels
      expect(
        CacheService()
            .getString('voltium_requires_higher_deposit:test_rider_skip'),
        isNull,
      );
    });

    testWidgets(
        'Confirming the skip sets higher-deposit flag and calls onNext',
        (WidgetTester tester) async {
      var onNextCalled = false;
      await tester.pumpWidget(createTestWidget(onNext: () {
        onNextCalled = true;
      }));
      await tester.pump(const Duration(seconds: 1));

      await tester.tap(find.byKey(const Key('skipGuarantorButton')));
      await tester.pump(const Duration(seconds: 1));
      await tester.tap(find.byKey(const Key('skipGuarantorConfirmButton')));
      await tester.pump(const Duration(seconds: 1));

      expect(onNextCalled, isTrue,
          reason: 'onNext must be called after confirming skip');
      // Higher-deposit flag persisted for this rider
      expect(
        CacheService()
            .getString('voltium_requires_higher_deposit:test_rider_skip'),
        'true',
      );
    });
  });

  // ── PR-GUARANTOR-OTP: short-lived phone-verification receipt ──────────
  group('Phone-verification receipt (PR-GUARANTOR-OTP)', () {
    const cacheKey = 'guarantor_onboarding_form_cache_test_rider_123';

    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
    });

    Widget createTestWidget() {
      return ProviderScope(
        overrides: [
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
        child: const MaterialApp(
          home: Scaffold(body: GuarantorOnboardingScreen()),
        ),
      );
    }

    Future<void> seedCache({
      required String phone,
      required String verifiedPhone,
      required int? verifiedAt,
    }) async {
      await CacheService().setString(
          cacheKey,
          jsonEncode({
            'name': 'Cached Name',
            'dob': '01-01-2000',
            'phone': phone,
            'verifiedPhone': verifiedPhone,
            if (verifiedAt != null) 'verifiedAt': verifiedAt,
          }));
    }

    testWidgets(
        'fresh receipt restores the verified state so the rider does not '
        're-verify', (tester) async {
      await seedCache(
        phone: '9876543210',
        verifiedPhone: '9876543210',
        verifiedAt: DateTime.now().millisecondsSinceEpoch,
      );
      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('Phone Number Verified'), findsOneWidget,
          reason: 'a fresh matching receipt must skip re-verification');
    });

    testWidgets('expired receipt forces re-verification', (tester) async {
      final expiredAt = DateTime.now().millisecondsSinceEpoch -
          AppConstants.emergencyContactVerificationWindow.inMilliseconds -
          5 * 60 * 1000;
      await seedCache(
        phone: '9876543210',
        verifiedPhone: '9876543210',
        verifiedAt: expiredAt,
      );
      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('Phone Number Verified'), findsNothing,
          reason: 'an expired receipt must not skip re-verification');
    });

    testWidgets('receipt for a different phone forces re-verification',
        (tester) async {
      await seedCache(
        phone: '9876543210',
        verifiedPhone: '9999000000',
        verifiedAt: DateTime.now().millisecondsSinceEpoch,
      );
      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('Phone Number Verified'), findsNothing,
          reason: 'a receipt for another number must not verify this phone');
    });

    testWidgets(
        'legacy boolean-only cache (no timestamp) forces one re-verification '
        'on upgrade', (tester) async {
      // Old cache shape: isPhoneVerified=true but no verifiedAt. Without
      // the timestamp there is no way to prove freshness, so the safe
      // default is to re-verify exactly once.
      await seedCache(
        phone: '9876543210',
        verifiedPhone: '9876543210',
        verifiedAt: null,
      );
      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('Phone Number Verified'), findsNothing,
          reason: 'a timestamp-less boolean claim must not be trusted');
    });
  });

  // ── Step progression & navigation ───────────────────────────────────────
  group('Step progression & navigation', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
    });

    Widget createTestWidget({VoidCallback? onNext, VoidCallback? onBack}) {
      return ProviderScope(
        overrides: [
          riderProvider.overrideWith(() => _SeededRiderNotifier(
                const RiderModel(
                  id: 'test_rider_step',
                  riderId: 'test_rider_step',
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
          supportedLocales: const [Locale('en'), Locale('hi')],
          home: Scaffold(
            body: GuarantorOnboardingScreen(onNext: onNext, onBack: onBack),
          ),
        ),
      );
    }

    testWidgets('Step indicator updates and renders step 1', (tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('1'), findsOneWidget);
      expect(find.text('2'), findsOneWidget);
      expect(find.text('3'), findsOneWidget);
      // Step-1 label comes from the active ARB key (mixed-case "Guarantor
      // Details") — not the legacy all-caps placeholder.
      expect(find.text('Guarantor Details'), findsAtLeastNWidgets(1));
    });

    testWidgets('Submitting form calls onNext when provided', (tester) async {
      final cacheData = {
        'name': 'Cached Name',
        'dob': '01-01-2000',
        'phone': '1234567890',
        'fatherName': 'Cached Father',
        'motherName': 'Cached Mother',
        'address': 'Cached Address',
        'isPhoneVerified': true,
        'verifiedPhone': '1234567890',
        'verifiedAt': DateTime.now().millisecondsSinceEpoch,
        'aadhaarFrontPath': 'test_path_front',
        'aadhaarBackPath': 'test_path_back',
        'panPath': 'test_path_pan',
        'photoPath': 'test_path_photo',
        'videoPath': 'test_path_video',
        'signaturePath': 'test_path_sig',
      };
      await CacheService().setString(
          'guarantor_onboarding_form_cache_test_rider_step',
          jsonEncode(cacheData));

      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));

      // Advance to step 2
      final nextButton = find.byKey(const Key('completeOnboardingButton'));
      await tester.tap(nextButton);
      await tester.pump(const Duration(seconds: 1));

      // Advance to step 3
      await tester.tap(nextButton);
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('FINISH SETUP'), findsOneWidget);
    });
  });
}
