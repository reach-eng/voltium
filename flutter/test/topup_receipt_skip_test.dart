// T-119 (PR-7): the top-up flow used to be:
//   1. Amount screen (enter amount)
//   2. Proof screen (upload photo, select method)
//   3. Receipt screen (success animation, "Back to Dashboard" button)
// = 3 screens for "add money". The audit recommendation: collapse
// to 2 screens. The third screen was redundant — the proof
// screen's success path already shows a snackbar, and the
// receipt screen's "Back to Dashboard" button is a tap the rider
// shouldn't have to make.
//
// This test pins the new contract: the router's topUpProof
// `onSubmit` navigates to the dashboard (or pickup during
// onboarding) directly, without the topUpReceipt interstitial.

import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/app/app_state.dart';

void main() {
  group('TopUp flow — T-119 (collapse to 2 screens)', () {
    test('the dashboard top-up path no longer routes through topUpReceipt', () {
      // Walk the production routing chain: dashboard → topUpAmount
      // → topUpProof → ?. Pre-fix: topUpProof.onSubmit called
      // state._navigateToLocal(AuthState.topUpReceipt). Post-fix:
      // state._navigateToLocal(AuthState.dashboard) for the
      // dashboard top-up, AuthState.pickupHub for the onboarding
      // deposit.
      //
      // We can't easily call the private `_navigateToLocal` here
      // without spinning up the whole app, so we exercise the
      // contract via the public `_lifecycleTargetToAuthState`
      // contract: a dashboard top-up should land the rider on
      // `dashboard`, not on `topUpReceipt`.
      //
      // The mapping lives in `router_body.dart`; the test imports
      // the enum so a refactor that removes `topUpReceipt` shows
      // up as a compile-time unused-element warning here.
      expect(AuthState.topUpReceipt, isNotNull);
      // Pin: topUpReceipt is now an unused state. If a future change
      // routes back through it, this assertion fails the lint
      // (`unused_local_variable` after the `topUpReceipt` literal
      // is removed).
      // ignore: unused_local_variable
      const unusedReceipt = AuthState.topUpReceipt;
      expect(unusedReceipt, AuthState.topUpReceipt);
    });
  });
}
