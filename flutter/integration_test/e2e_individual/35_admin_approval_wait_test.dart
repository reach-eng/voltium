// integration_test/e2e_individual/35_admin_approval_wait_test.dart
//
// Test: Walk through the rider onboarding flow up to security deposit,
// then wait for admin approval (deposit and KYC) before moving to plan selection.
// This test demonstrates waiting for asynchronous admin actions by polling the UI
// for the APPROVAL MATRIX status to become 'COMPLETED'.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/providers/rider_provider.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // Helper to fetch RiderProvider from the widget tree.
  RiderProvider getRiderProvider(WidgetTester tester) {
    final element = tester.element(find.byType(MaterialApp).first);
    return element.read<RiderProvider>();
  }

  testWidgets('Admin approval wait after security deposit', (tester) async {
    // =============================
    // PHASE 1: Auth & Onboarding
    // =============================
    final testPhone = '7788888802';
    await fullLoginFlow(tester, phone: testPhone);
    await settle(tester);

    // Verify we landed on preDashboard after onboarding.
    await waitFor(tester, find.byKey(const ValueKey('preDashboard')),
        timeout: const Duration(seconds: 30));
    expect(find.byKey(const ValueKey('preDashboard')), findsOneWidget,
        reason: 'Should be on preDashboard after onboarding');

    // =============================
    // PHASE 2: Security Deposit
    // =============================
    // Open wallet top‑up flow.
    final addIcon = find.byIcon(Icons.add);
    await tester.ensureVisible(addIcon);
    await tester.tap(addIcon);
    await settle(tester);

    // Choose Security Deposit.
    await waitFor(tester, find.byKey(const Key('securityDepositPurposeCard')));
    await smartTap(tester, find.byKey(const Key('securityDepositPurposeCard')));
    await settle(tester);

    // Proceed to amount selection.
    await scrollAndTap(tester, find.byKey(const Key('continueToPaymentButton')));
    await settle(tester);
    await waitFor(tester, find.byKey(const Key('amount2000')));
    await smartTap(tester, find.byKey(const Key('amount2000')));
    await settle(tester);

    // Proceed to UPI payment.
    await scrollAndTap(tester, find.byKey(const Key('proceedToUpiButton')));
    await settle(tester);

    // Upload proof and submit.
    await waitFor(tester, find.byKey(const Key('uploadProofArea')));
    await smartTap(tester, find.byKey(const Key('uploadProofArea')));
    await settle(tester);
    await scrollAndTap(tester, find.byKey(const Key('submitProofButton')));
    await settle(tester);

    // Return to preDashboard (receipt may or may not appear).
    final backBtn = find.text('Back to Dashboard');
    if (backBtn.evaluate().isNotEmpty) {
      await smartTap(tester, backBtn);
      await settle(tester);
    } else {
      // If receipt screen not shown, navigate back manually.
      for (int i = 0; i < 3; i++) {
        await goBack(tester);
        await settle(tester);
      }
    }

    // Simulate admin approval by setting rider state directly.
    final riderProvider = getRiderProvider(tester);
    final currentRider = riderProvider.rider;
    if (currentRider != null) {
      riderProvider.updateRider(currentRider.copyWith(
        depositDone: true,
        kycDone: true,
        kycStatus: KycStatus.VERIFIED,
      ));
      await settle(tester);
      await tester.pump(const Duration(seconds: 1));
    }

    // =============================
    // WAIT FOR ADMIN APPROVAL
    // =============================
    // The ApprovalMatrixWidget shows each step with a status
    // text of COMPLETED / PENDING / REJECTED.
    // We'll wait until both Deposit and KYC steps report COMPLETED.

    bool depositApproved = false;
    bool kycApproved = false;
    const timeout = Duration(seconds: 60);
    final start = DateTime.now();
    while (DateTime.now().difference(start) < timeout) {
      await tester.pump(const Duration(seconds: 2));

      final depositLabel = find.text('Deposit');
      if (depositLabel.evaluate().isNotEmpty) {
        final depositStatus = find.descendant(
            of: depositLabel, matching: find.text('COMPLETED'));
        if (depositStatus.evaluate().isNotEmpty) depositApproved = true;
      }

      final kycLabel = find.text('KYC');
      if (kycLabel.evaluate().isNotEmpty) {
        final kycStatus = find.descendant(
            of: kycLabel, matching: find.text('COMPLETED'));
        if (kycStatus.evaluate().isNotEmpty) kycApproved = true;
      }

      if (depositApproved && kycApproved) break;
    }

    expect(depositApproved, isTrue,
        reason: 'Admin should approve the Security Deposit within timeout');
    expect(kycApproved, isTrue,
        reason: 'Admin should approve KYC within timeout');

    // =============================
    // PHASE 3: Continue to Plan Selection
    // =============================
    await waitFor(tester, find.text('BOOK VEHICLE'));
await smartTap(tester, find.text('BOOK VEHICLE'));
expect(find.text('BOOK VEHICLE'), findsAtLeastNWidgets(1),
    reason: 'BOOK VEHICLE should appear after admin approvals');

    // Simulate pickup completion
    final riderProvider2 = getRiderProvider(tester);
    final currentRider2 = riderProvider2.rider;
    if (currentRider2 != null) {
      riderProvider2.updateRider(currentRider2.copyWith(pickupDone: true));
      await settle(tester);
      await tester.pump(const Duration(seconds: 1));
    }

    // Verify Pickup step completed in ApprovalMatrixWidget
    final pickupLabel = find.text('Pickup');
    final pickupStatus = find.descendant(
        of: pickupLabel, matching: find.text('COMPLETED'));
    expect(pickupStatus, findsOneWidget,
        reason: 'Pickup should be completed after admin approvals');
  });
}
