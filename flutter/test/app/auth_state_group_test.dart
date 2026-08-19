// PR-ONBOARDING-FLOW-2026-08-11: tests for the `isPreDashboardOrSub`
// extension on AuthState.
//
// Purpose: the router's `didChangeDependencies` uses this set to decide
// whether to re-route a rider when the lifecycle gate would say
// preDashboard. A rider mid-sub-flow (e.g. choosePlan, pickupHub) must
// stay on the sub-flow; the guard prevents the redirect from bouncing
// them out.
//
// hangTight is the new active flow's tail state. It is included in the
// set so the polling cadence on hangTight does not cause transient
// redirects to preDashboard when the server returns a stale rank.
//
// PR-ONBOARDING-FLOW-2026-08-13: topUpAmount is also in the set
// (between choosePlan and planSuccess) so the amount-entry polling
// does not bounce the rider out of the screen mid-entry.

import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/app/app_state.dart';
import 'package:voltium_rider/app/auth_state_group.dart';

void main() {
  group('AuthState.isPreDashboardOrSub', () {
    test('preDashboard itself is in the set', () {
      expect(AuthState.preDashboard.isPreDashboardOrSub, isTrue);
    });

    test('archived sub-screens are in the set', () {
      expect(AuthState.choosePlan.isPreDashboardOrSub, isTrue);
      expect(AuthState.planSuccess.isPreDashboardOrSub, isTrue);
      expect(AuthState.pickupHub.isPreDashboardOrSub, isTrue);
      expect(AuthState.pickupVerification.isPreDashboardOrSub, isTrue);
      expect(AuthState.pickupSuccess.isPreDashboardOrSub, isTrue);
    });

    test(
        'PR-ONBOARDING-FLOW-2026-08-13: topUpAmount is in the set (active-path Enter Amount screen)',
        () {
      // The Enter Amount screen is the active-path deposit entry
      // point. Polling during the amount entry must not bounce the
      // rider out of the screen — same bounce-protection rationale
      // as the other sub-screens.
      expect(AuthState.topUpAmount.isPreDashboardOrSub, isTrue);
    });

    test('top-up sub-flow screens are in the set', () {
      expect(AuthState.topUpAmount.isPreDashboardOrSub, isTrue);
      expect(AuthState.topUpUpi.isPreDashboardOrSub, isTrue);
      expect(AuthState.topUpProof.isPreDashboardOrSub, isTrue);
      expect(AuthState.topUpReceipt.isPreDashboardOrSub, isTrue);
    });

    test(
        'PR-ONBOARDING-FLOW-2026-08-11: hangTight is in the set — the new '
        'active flow tail', () {
      // The polling cadence (15s) on hangTight calls refreshFromApi,
      // which can cause transient lifecycle re-evaluations. Without the
      // guard, a transient rank drop would bounce the rider to
      // preDashboard and back, causing UX churn. Keeping hangTight in
      // the set is the same trade-off as the choosePlan/pickupHub
      // sub-screens: when the lifecycle gate's "intended" target is
      // preDashboard, the rider stays on the sub-flow.
      expect(AuthState.hangTight.isPreDashboardOrSub, isTrue);
    });

    test('pre-auth gate states are NOT in the set', () {
      expect(AuthState.splash.isPreDashboardOrSub, isFalse);
      expect(AuthState.legal.isPreDashboardOrSub, isFalse);
      expect(AuthState.permissions.isPreDashboardOrSub, isFalse);
      expect(AuthState.login.isPreDashboardOrSub, isFalse);
      expect(AuthState.otp.isPreDashboardOrSub, isFalse);
    });

    test('onboarding entry states are NOT in the set', () {
      // These are upstream of preDashboard — a rider on the intent
      // form is not "inside the pre-dashboard flow" yet.
      expect(AuthState.intent.isPreDashboardOrSub, isFalse);
      expect(AuthState.userForm.isPreDashboardOrSub, isFalse);
      expect(AuthState.guarantorForm.isPreDashboardOrSub, isFalse);
      expect(AuthState.kycPreflight.isPreDashboardOrSub, isFalse);
    });

    test('terminal / post-flow states are NOT in the set', () {
      expect(AuthState.dashboard.isPreDashboardOrSub, isFalse);
      expect(AuthState.accountClosed.isPreDashboardOrSub, isFalse);
      expect(AuthState.rentalDetails.isPreDashboardOrSub, isFalse);
      expect(AuthState.endRental.isPreDashboardOrSub, isFalse);
    });
  });
}
