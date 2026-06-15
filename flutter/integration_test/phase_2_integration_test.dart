import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Phase 2: System Integration & State Flow', () {
    testWidgets('Step 1: Complete Auth & Onboarding Journey', (tester) async {
      // Use a unique phone to ensure fresh state and avoid "JOHN DOE" leftovers
      final testPhone = '9991112222';

      // 1. Launch app and complete the full flow
      await launchApp(tester);
      await completeAuthFlow(tester, phone: testPhone);
      await completeOnboardingFlow(tester);

      // 2. Verify Dashboard identity
      await expectOnDashboard(tester);
      await settle(tester, timeout: const Duration(seconds: 10));

      final nameFinder = find.byKey(const Key('riderNameText'));
      expect(nameFinder, findsOneWidget);
      final nameText = (tester.widget(nameFinder) as Text).data;
      print('DEBUG: Found name on Dashboard: $nameText');
      expect(nameText?.toUpperCase(),
          contains(TestCredentials.fullName.toUpperCase()));
    });

    testWidgets('Step 2: State Persistence (Cold Start Simulation)',
        (tester) async {
      // 1. Manually seed the cache to simulate an existing session
      await resetAppState();
      final testName = 'Persistent Rider';
      final testPhone = '9998887777';
      await CacheService().cacheRider({
        'id': 'persistent-rider-123',
        'name': testName,
        'phone': testPhone,
        'status': 'ACTIVE',
        'pickupDone': true,
      });

      // 2. Launch app
      await safeAppMain();
      await settle(tester);

      // 3. Wait past splash
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      // 4. Verify we are directly on Dashboard (skipping Auth/Onboarding)
      await expectOnDashboard(tester);
      await settle(tester, timeout: const Duration(seconds: 10));

      final nameFinder = find.byKey(const Key('riderNameText'));
      expect(nameFinder, findsOneWidget);
      final nameText = (tester.widget(nameFinder) as Text).data;
      print('DEBUG: Found name on Dashboard: $nameText');
      expect(nameText?.toUpperCase(), contains(testName.toUpperCase()));
    });

    testWidgets('Step 3: Session Invalidation on Logout', (tester) async {
      // 1. Start on Dashboard (seeded)
      await setupReturningUser();
      await safeAppMain();
      await settle(tester);
      await tester.pump(const Duration(seconds: 4));
      await settle(tester);

      // 2. Navigate to Profile
      await navigateToTab(tester, 'profileTab');
      await settle(tester, timeout: const Duration(seconds: 5));

      // 3. Scroll to Logout and Tap
      final logoutBtn = find.byKey(const Key('logoutButton'));
      await tester.scrollUntilVisible(logoutBtn, 500);
      await settle(tester);
      await tester.tap(logoutBtn);
      await settle(tester);

      // 4. Confirm Logout Dialog
      final confirmBtn = find.text('Logout');
      if (confirmBtn.evaluate().isNotEmpty) {
        await tester.tap(confirmBtn.last);
        await settle(tester);
      }

      // 5. Verify we are back at Auth Choice screen
      await waitFor(tester, find.byKey(const Key('loginWithPhoneButton')),
          timeout: const Duration(seconds: 15));
      expectOnAuthChoice(tester);

      // 6. Verify cache is cleared
      final cachedRider = CacheService().getCachedRider();
      expect(cachedRider, isNull);
    });
  });
}
