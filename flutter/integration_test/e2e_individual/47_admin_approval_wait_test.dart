// integration_test/e2e_individual/47_admin_approval_wait_test.dart
//
// ONBOARDING-AUDIT 2026-08-14 (fix #1): the previous version of this
// test asserted the legacy pre-dashboard + ApprovalMatrixWidget path
// (`preDashboardScreen`, `addIcon`, `securityDepositPurposeCard`,
// `BOOK VEHICLE`, the `COMPLETED` ApprovalMatrixWidget status rows).
// After PR-ONBOARDING-FLOW-2026-08-12 the active path now goes
// guarantor → choosePlan → topUpAmount → topUpProof → pickupHub →
// pickupVerification → hangTight → dashboard, and the
// ApprovalMatrixWidget is no longer rendered on the pre-dashboard
// surface (that surface is preserved for legacy reasons and admin
// tooling, but is not reached from the active path). The test has
// been re-shaped to assert on the HangTight wait state and the
// rider's auto-transition to the dashboard once admin approval
// lands.
//
// Test: Walk through the active path to the HangTight wait state,
// then verify the rider is auto-redirected to the active dashboard
// once BOTH admin approvals (KYC + security deposit) land.
//
// PR-HANGTIGHT-2026-09-06: the redirect no longer fires on
// `pickupDone` alone (the server sets pickedUpAt at pickup time) nor
// on `KycStatus.verified` — it mirrors the server's activation inputs
// exactly: kycStatus == APPROVED && (depositStatus == APPROVED ||
// securityDeposit > 0). The test now asserts the rider stays on
// HangTight after the first approval and transitions after the second.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../pages/app_robots.dart';
import 'package:integration_test/integration_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import '../helpers/test_helpers.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  // Helper to fetch RiderProvider from the widget tree.
  RiderProvider getRiderProvider(WidgetTester tester) {
    final element = tester.element(find.byType(MaterialApp).first);
    return element.read<RiderProvider>();
  }

  testWidgets('Admin approval wait → HangTight → active dashboard',
      (tester) async {
    final app = AppRobots(tester);
    // =============================
    // PHASE 1: Auth & active onboarding to plan selection
    // =============================
    const testPhone = '7788888802';
    await fullLoginFlow(tester, phone: testPhone);
    await settle(tester);

    // ONBOARDING-AUDIT 2026-08-14 (fix #1): the active path now
    // lands on plan selection after guarantor, not on
    // pre-dashboard. Wait for the plan screen.
    await waitFor(
      tester,
      find.text('Choose a rental plan').or(find.text('Pick a plan')),
      timeout: const Duration(seconds: 30),
    );

    // =============================
    // PHASE 2: Plan → security deposit → pickup → hangTight
    // =============================
    // 2a. Plan: tap the first plan card and "Continue to wallet".
    final planCard0 = app.dashboard.planCard_0;
    await smartTap(tester, planCard0);
    await settle(tester);
    final continueToWallet = find.text('Continue to wallet');
    await waitFor(tester, continueToWallet);
    await scrollAndTap(tester, continueToWallet);
    await settle(tester);

    // 2b. TopUpAmount: pick the first amount chip and tap Pay.
    await waitFor(tester, find.text('Top up your wallet'));
    await smartTap(tester, app.wallet.amount2000);
    await settle(tester);
    await scrollAndTap(tester, find.textContaining('Pay'));
    await settle(tester);

    // 2c. TopUpProof: upload a mock file in TEST_MODE and submit.
    await waitFor(tester, app.onboarding.uploadProofArea);
    await smartTap(tester, app.onboarding.uploadProofArea);
    await settle(tester);
    await scrollAndTap(tester, app.onboarding.submitProofButton);
    await settle(tester);

    // 2d. After proof, the active path advances to the pickup
    // hub. We skip the detailed hub form (covered by
    // 46_pickup_screen_test.dart) and forward to verification.
    await waitFor(
      tester,
      find.byKey(const Key('pickupHubScreen')),
      timeout: const Duration(seconds: 30),
    );
    final pickupNext = find.byKey(const Key('pickupNextButton'));
    if (pickupNext.evaluate().isNotEmpty) {
      await smartTap(tester, pickupNext);
      await settle(tester);
    }
    final agreement = find.byKey(const Key('rentalAgreementCheckbox'));
    if (agreement.evaluate().isNotEmpty) {
      await tester.tap(agreement);
      await settle(tester);
      await scrollAndTap(tester, find.byKey(const Key('completePickupButton')));
      await settle(tester);
    }

    // 2e. HangTight — the new async wait state.
    await waitFor(
      tester,
      find.text('Hang tight').or(find.text('We\'re setting up your account')),
      timeout: const Duration(seconds: 30),
    );

    // =============================
    // PHASE 3: Simulate admin approvals → dashboard
    // =============================
    // PR-HANGTIGHT-2026-09-06: the HangTight screen shows exactly two
    // approval rows (KYC + wallet top-up) and the redirect fires only
    // when BOTH are approved (or the server flips lifecycleStatus to
    // ACTIVE). Simulate the approvals one at a time and assert the
    // rider is still waiting after the first.
    final riderProvider = getRiderProvider(tester);
    final currentRider = riderProvider.rider;
    expect(
      currentRider,
      isNotNull,
      reason: 'Rider must be available on HangTight',
    );

    // 3a. First approval only (KYC) — deposit still pending. The rider
    // must remain on HangTight (raw pickupDone=true must NOT redirect).
    riderProvider.updateRider(
      currentRider!.copyWith(
        kycStatus: KycStatus.approved,
        kycDone: true,
        planDone: true,
        currentPlan: 'Weekly',
        planStatus: 'ACTIVE',
        assignedVehicle: 'TEST-VEH-001',
        pickupDone: true,
      ),
    );
    await settle(tester);
    await tester.pump(const Duration(seconds: 2));
    await settle(tester);
    expect(
      app.dashboard.dashboardTab,
      findsNothing,
      reason:
          'KYC approval alone must NOT transition — deposit approval still pending',
    );

    // 3b. Second approval (security deposit) completes the set → the
    // HangTight auto-redirect fires to the active dashboard.
    riderProvider.updateRider(
      riderProvider.rider!.copyWith(
        depositStatus: DepositStatus.approved,
        depositDone: true,
      ),
    );
    await settle(tester);
    // Allow HangTight to auto-redirect on the next frame.
    await tester.pump(const Duration(seconds: 2));
    await settle(tester);

    // =============================
    // PHASE 4: Assert on the active dashboard
    // =============================
    // The previous "Pickup COMPLETED in ApprovalMatrixWidget"
    // assertion is gone — that surface is no longer reached
    // from the active path. The new landing surface is the
    // active dashboard.
    expect(
      app.dashboard.dashboardTab,
      findsAtLeastNWidgets(1),
      reason: 'Should land on active dashboard after admin approval',
    );
  });
}
