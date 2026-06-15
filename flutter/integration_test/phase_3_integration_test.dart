// flutter/integration_test/phase_3_integration_test.dart

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/models/rider_model.dart';

import 'helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('Phase 3: Financial & Transactional Flows', () {
    const String testPhone = '9993333333';

    testWidgets('Step 1: Wallet Top-up & Balance Update', (tester) async {
      await fullLoginFlow(tester, phone: testPhone);

      // 1. Navigate to Wallet
      await navigateToTab(tester, 'walletTab');
      await settle(tester);

      // Get initial balance
      final balanceFinder = find.byKey(const Key('walletBalanceText'));
      expect(balanceFinder, findsOneWidget);
      final initialText = (tester.widget(balanceFinder) as Text).data ?? '0';
      final initialBalance =
          double.tryParse(initialText.replaceAll(',', '')) ?? 0.0;
      debugPrint('Initial Balance: $initialBalance');

      // 2. Open Top-up flow
      await tester.tap(find.byKey(const Key('topUpButton')).first);
      await settle(tester);

      // Select Purpose: Wallet Top-up
      await tester.tap(find.text('Wallet Top-up'));
      await settle(tester);
      await tester.tap(find.text('Continue to Payment'));
      await settle(tester);

      // Enter Amount: 500
      await tester.enterText(find.byKey(const Key('customAmountField')), '500');
      await settle(tester);
      await tester.tap(find.text('Proceed to UPI Payment'));
      await settle(tester);

      // 3. Upload Proof (TEST_MODE bypass)
      await tester.tap(find.byKey(const Key('uploadProofArea')));
      await settle(tester);

      // Submit Proof
      await tester.tap(find.byKey(const Key('submitProofButton')));
      await settle(tester);

      // 4. Verify Balance increased by 500
      // We expect the app to return to Wallet and refresh
      await waitFor(tester, find.byKey(const Key('walletBalanceText')));
      final updatedText = (tester.widget(balanceFinder) as Text).data ?? '0';
      final updatedBalance =
          double.tryParse(updatedText.replaceAll(',', '')) ?? 0.0;

      expect(updatedBalance, initialBalance + 500);
    });

    testWidgets('Step 2: Vehicle Return Workflow', (tester) async {
      await fullLoginFlow(tester, phone: testPhone);
      await expectOnDashboard(tester);

      // 1. Open Subscription Management
      final manageBtn = find.byKey(const Key('manageSubscriptionButton'));
      await tester.scrollUntilVisible(manageBtn, 100.0);
      await tester.tap(manageBtn.first);
      await tester.pumpAndSettle();
      await tester
          .pump(const Duration(seconds: 2)); // Wait for bottom sheet animation

      // 2. Click "End Rental"
      final endRentalBtn = find.byKey(const Key('endRentalButton'));
      await waitFor(tester, endRentalBtn);
      await tester.tap(endRentalBtn);
      await settle(tester);

      // 3. Complete Return Form
      // Photos (using our TEST_MODE bypass)
      await tester.tap(find.byKey(const Key('photoSlot_front')));
      await settle(tester);
      await tester.tap(find.byKey(const Key('photoSlot_rear')));
      await settle(tester);
      await tester.tap(find.byKey(const Key('photoSlot_left')));
      await settle(tester);
      await tester.tap(find.byKey(const Key('photoSlot_right')));
      await settle(tester);

      // Odometer
      final odometerField = find.byKey(const Key('odometerField'));
      await tester.enterText(odometerField, '12500');
      await settle(tester);

      // Checkbox
      await tester.tap(find.byKey(const Key('confirmCheckbox')));
      await settle(tester);

      // Submit
      final submitBtn = find.byKey(const Key('submitReturnButton'));
      await tester.ensureVisible(submitBtn);
      await tester.tap(submitBtn, warnIfMissed: false);
      await settle(tester);

      // 4. Verify Success State
      await waitFor(tester, find.text('Request Submitted!'),
          timeout: const Duration(seconds: 15));
      expect(find.text('Request Submitted!'), findsOneWidget);
    });
  });
}
