// DEEP-AUDIT D-P1-4 (2026-08-08): the previous implementation in
// router.dart hand-enumerated 10 of 28 AuthState cases as "sub-screens of
// preDashboard" inside an if/else. Adding a new sub-screen required editing
// the if/else — a contract that lived in router.dart was implicit and easy
// to forget. This extension is the single source of truth: every place that
// asks "is this state a preDashboard sub-screen?" now reads the same set.
//
// Usage:
//   if (_currentState.isPreDashboardOrSub) { ... }
//
// Adding a new preDashboard sub-screen is now one line: add the case to
// isPreDashboardOrSub and the contract is visible to anyone reading
// either file.

import 'app_state.dart';

extension AuthStateGroup on AuthState {
  /// True when this state is `preDashboard` or any sub-screen of it
  /// (plan selection, deposit workflow, pickup flow, top-up flow,
  /// hang-tight wait). The router's lifecycle-redirect skips
  /// re-navigating when the rider is already inside one of these
  /// sub-flows — a re-fetch of /api/rider/dashboard can flip
  /// `lifecycleStatus` mid-flow and the redirect would otherwise drag
  /// the rider back to the top of the flow. hangTight is included
  /// because it is the new active flow's tail state (post-pickup,
  /// pre-activation wait) — the lifecycle gate must keep the rider
  /// there while rank == 10 (PICKUP_SCHEDULED) with !pickupDone and
  /// only move them on to dashboard once rank >= 11.
  bool get isPreDashboardOrSub {
    switch (this) {
      case AuthState.preDashboard:
      case AuthState.choosePlan:
      case AuthState.planSuccess:
      case AuthState.pickupHub:
      case AuthState.pickupVerification:
      case AuthState.topUpAmount:
      case AuthState.topUpUpi:
      case AuthState.topUpProof:
      case AuthState.topUpReceipt:
      case AuthState.hangTight:
        return true;
      default:
        return false;
    }
  }

  /// True when this state is a pre-auth gate (legal wall, permissions
  /// gate, phone entry, OTP entry). The router uses this to short-circuit
  /// lifecycle-redirect — a rider mid-OTP is not "logged out" and the
  /// redirect should never fire.
  bool get isUnauthenticatedGate {
    switch (this) {
      case AuthState.splash:
      case AuthState.legal:
      case AuthState.permissions:
      case AuthState.login:
      case AuthState.otp:
        return true;
      default:
        return false;
    }
  }
}
