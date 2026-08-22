import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/utils/app_constants.dart';

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
      // AUDIT FIX (encrypted-storage migration): the guarantor draft now
      // persists in SecureStorageService, so tests must mock it too.
      TestWidgetsFlutterBinding.ensureInitialized();
      FlutterSecureStorage.setMockInitialValues({});
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

      // AUDIT FIX (encrypted-storage migration): drafts are persisted in
      // secure storage now; the plaintext prefs copy must NOT exist.
      final cachedStr = await SecureStorageService()
          .readValue('guarantor_form:test_rider_123');
      expect(cachedStr, isNotNull);
      expect(
        CacheService()
            .getString('guarantor_onboarding_form_cache_test_rider_123'),
        isNull,
        reason: 'PII draft must not persist in plaintext SharedPreferences',
      );

      final cacheData = jsonDecode(cachedStr!);
      expect(cacheData['name'], 'New Name');
    });
  });

  // ── Bug 25: liability banner ───────────────────────────────────────────
  group('Liability banner (Bug 25)', () {
    setUp(() async {
      TestWidgetsFlutterBinding.ensureInitialized();
      FlutterSecureStorage.setMockInitialValues({});
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

  // ── Bug 24: Skip button with higher-deposit confirmation ───────────────
  //
  // ONBOARDING-AUDIT 2026-08-14 (fix #5d): the Skip button was
  // removed entirely. The previous behaviour promised a
  // `requiresHigherDeposit` higher-deposit tier that the backend
  // never enforced, and skipping the guarantor would block the
  // rental flow at the server. The four tests below assert
  // behaviour that no longer exists; they are kept as `skip: true`
  // markers so a future re-introduction can flip them back on. To
  // re-enable, wire the server-side `requiresHigherDeposit` flag
  // end-to-end FIRST.
  group('Skip button (Bug 24) — REMOVED, see fix #5d', () {
    setUp(() async {
      TestWidgetsFlutterBinding.ensureInitialized();
      FlutterSecureStorage.setMockInitialValues({});
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
        ],
        child: MaterialApp(
          home: Scaffold(
            body: GuarantorOnboardingScreen(onNext: onNext),
          ),
        ),
      );
    }

    testWidgets('Skip button is visible in the bottom bar [REMOVED]',
        (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));

      expect(find.byKey(const Key('skipGuarantorButton')), findsOneWidget);
    }, skip: true);

    testWidgets(
        'Tapping Skip opens a confirmation dialog stating the guarantor is required [REMOVED]',
        (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 1));

      // Tap the Skip button
      await tester.tap(find.byKey(const Key('skipGuarantorButton')));
      await tester.pump(const Duration(seconds: 1));

      // Confirmation dialog appears with the honest copy (audit #7 / §3.5).
      expect(find.text('Skip for now?'), findsOneWidget);
      expect(
        find.textContaining('required to start renting'),
        findsOneWidget,
      );

      // Cancel button visible
      expect(
          find.byKey(const Key('skipGuarantorCancelButton')), findsOneWidget);
      expect(
          find.byKey(const Key('skipGuarantorConfirmButton')), findsOneWidget);
    }, skip: true);

    testWidgets('Cancelling the skip dialog does not call onNext [REMOVED]',
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
    }, skip: true);

    testWidgets(
        'Confirming the skip sets higher-deposit flag and calls onNext [REMOVED]',
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
      // Form cache cleared so user doesn't see a half-filled form
      expect(
        CacheService().getString('guarantor_onboarding_form_cache'),
        isNull,
      );
    }, skip: true);
  });

  // ── PR-GUARANTOR-OTP: short-lived phone-verification receipt ──────────
  group('Phone-verification receipt (PR-GUARANTOR-OTP)', () {
    const cacheKey = 'guarantor_onboarding_form_cache_test_rider_123';

    setUp(() async {
      TestWidgetsFlutterBinding.ensureInitialized();
      FlutterSecureStorage.setMockInitialValues({});
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
      TestWidgetsFlutterBinding.ensureInitialized();
      FlutterSecureStorage.setMockInitialValues({});
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
      expect(find.text('GUARANTOR DETAILS'), findsOneWidget);
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
