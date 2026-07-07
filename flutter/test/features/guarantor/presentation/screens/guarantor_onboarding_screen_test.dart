import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';
import '../../../../helpers/golden_test_helper.dart';
import 'dart:convert';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/models/rider_model.dart';

void main() {
  group('Widget and Cache Tests', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
    });

    Widget createTestWidget({VoidCallback? onNext}) {
      final appProvider = AppProvider();
      appProvider.riderProvider.setRider(const RiderModel(
        id: 'test_rider_123',
        riderId: 'test_rider_123',
        name: 'Test Rider',
        phone: '9999999999',
        lifecycleStatus: 'NEW',
      ));
      return MultiProvider(
        providers: [
          ChangeNotifierProvider<AppProvider>.value(value: appProvider),
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
      await tester.pumpAndSettle();

      expect(find.text('Guarantor Details'), findsWidgets);
      expect(find.text('FINISH SETUP'), findsOneWidget);
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
      await tester.pumpAndSettle();

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
      await tester.pumpAndSettle();

      final nameField = find.byType(TextField).first;
      await tester.enterText(nameField, 'New Name');
      await tester.pumpAndSettle();

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
      final appProvider = AppProvider();
      appProvider.riderProvider.setRider(const RiderModel(
        id: 'test_rider_banner',
        riderId: 'test_rider_banner',
        name: 'Test Rider',
        phone: '9999999999',
        lifecycleStatus: 'NEW',
      ));
      return MultiProvider(
        providers: [
          ChangeNotifierProvider<AppProvider>.value(value: appProvider),
        ],
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
      await tester.pumpAndSettle();

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
  group('Skip button (Bug 24)', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
    });

    Widget createTestWidget({VoidCallback? onNext}) {
      final appProvider = AppProvider();
      appProvider.riderProvider.setRider(const RiderModel(
        id: 'test_rider_skip',
        riderId: 'test_rider_skip',
        name: 'Test Rider',
        phone: '9999999999',
        lifecycleStatus: 'NEW',
      ));
      return MultiProvider(
        providers: [
          ChangeNotifierProvider<AppProvider>.value(value: appProvider),
        ],
        child: MaterialApp(
          home: Scaffold(
            body: GuarantorOnboardingScreen(onNext: onNext),
          ),
        ),
      );
    }

    testWidgets('Skip button is visible in the bottom bar',
        (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('skipGuarantorButton')), findsOneWidget);
    });

    testWidgets(
        'Tapping Skip opens a confirmation dialog explaining higher deposit',
        (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pumpAndSettle();

      // Tap the Skip button
      await tester.tap(find.byKey(const Key('skipGuarantorButton')));
      await tester.pumpAndSettle();

      // Confirmation dialog appears
      expect(find.text('Skip Guarantor?'), findsOneWidget);
      expect(
        find.textContaining('₹5,000 instead of ₹2,000'),
        findsOneWidget,
      );

      // Cancel button visible
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
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('skipGuarantorButton')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('skipGuarantorCancelButton')));
      await tester.pumpAndSettle();

      expect(onNextCalled, isFalse);
      // Higher-deposit flag must NOT be set when user cancels
      expect(
        CacheService()
            .getString('voltium_requires_higher_deposit:test_rider_skip'),
        isNull,
      );
    });

    testWidgets('Confirming the skip sets higher-deposit flag and calls onNext',
        (WidgetTester tester) async {
      var onNextCalled = false;
      await tester.pumpWidget(createTestWidget(onNext: () {
        onNextCalled = true;
      }));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('skipGuarantorButton')));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('skipGuarantorConfirmButton')));
      await tester.pumpAndSettle();

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
    });
  });
}
