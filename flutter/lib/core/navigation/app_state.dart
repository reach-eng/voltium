// R4.1 — Explicit AppState sealed class hierarchy (replaces the flat
// `AuthState` enum in lib/app/app_state.dart).
//
// Why: the existing enum has 28 cases in a flat namespace. Every screen
// transition is an implicit "any-state → any-state" jump, which is the
// root cause of the "stuck on splash" / "stuck on pre-dashboard" issues
// flagged in the R4 audit. The sealed class makes the state space
// hierarchical (the auth flow is a state, and the *step* within the
// flow is a sub-state) so transitions are scoped to a smaller state
// space and forbidden jumps can be detected at runtime.
//
// Migration plan (R4.2-R4.5):
//   R4.2 — go_router is added; the state machine is the source of truth
//   R4.3 — AppShell consumes AppState via StateNotifier + GoRouter
//   R4.4 — AuthRepositoryImpl.verifyOtp returns the new AppState
//   R4.5 — PollingManager instances are scoped to specific states
//
// PR-ONBOARDING-FLOW-2026-08-13: until the migration above lands, this
// sealed class is **documentational only**. The router in
// `lib/app/router.dart` continues to use the legacy `AuthState` enum
// and never calls `isAllowedTransition`. The transition matrix below
// is the forward-looking guard that the R4 work will wire in; today
// the only consumer is the unit tests in
// `test/core/navigation/state_machine_transition_matrix_test.dart`.
// The conversion helpers `appStateFromAuthState` and
// `authStateFromAppState` are used by the `verifyOtp` flow to derive
// the post-OTP target; the router does not round-trip through
// `AppState` for live navigation. Both will coexist during the
// migration window.

import 'package:voltium_rider/app/app_state.dart';

/// Thrown when a state transition is attempted that the state machine
/// forbids (e.g. Splash → ActiveDashboard without going through
/// AuthFlow + Onboarding).
class AppStateError implements Exception {
  final AppState from;
  final AppState to;
  AppStateError(this.from, this.to);
  @override
  String toString() =>
      'AppStateError: illegal transition ${from.runtimeType} → ${to.runtimeType}';
}

/// Top-level app state. Each subclass is a distinct screen the user
/// is currently looking at.
sealed class AppState {
  const AppState();

  /// Human-readable name for logging + telemetry.
  String get debugName => runtimeType.toString();
}

// ── Pre-auth ─────────────────────────────────────────────────────────

class Splash extends AppState {
  const Splash();
}

class LegalGate extends AppState {
  const LegalGate();
}

class PermissionsGate extends AppState {
  const PermissionsGate();
}

// ── Auth flow ────────────────────────────────────────────────────────

enum AuthStep { phoneEntry, otpVerify }

class AuthFlow extends AppState {
  final AuthStep step;
  const AuthFlow(this.step);
}

// ── Onboarding flow (KYC → guarantor → deposit → plan) ───────────────

enum OnboardingStep { kycSubmit, guarantor, deposit, planSelect }

class Onboarding extends AppState {
  final OnboardingStep step;
  const Onboarding(this.step);
}

// ── Main app ─────────────────────────────────────────────────────────

class PreDashboard extends AppState {
  const PreDashboard();
}

// PR-ONBOARDING-FLOW-2026-08-11: async wait state in the new active
// onboarding path. Returned when a rider is in PICKUP_SCHEDULED (rank
// 10) but not yet ACTIVE — they have submitted the pickup form and are
// waiting for admin to assign a vehicle and approve. Replaces the
// synchronous pre-dashboard wait at the tail of the new flow.
class HangTight extends AppState {
  const HangTight();
}

class ActiveDashboard extends AppState {
  const ActiveDashboard();
}

class AccountClosed extends AppState {
  const AccountClosed();
}

// ── State machine transitions ───────────────────────────────────────

/// Returns true if the transition from [from] to [to] is allowed by
/// the state machine. Forbidden jumps throw an [AppStateError] when
/// [throwOnForbidden] is true; otherwise they return false.
bool isAllowedTransition(
  AppState from,
  AppState to, {
  bool throwOnForbidden = false,
}) {
  final allowed = _isAllowed(from, to);
  if (!allowed && throwOnForbidden) {
    throw AppStateError(from, to);
  }
  return allowed;
}

bool _isAllowed(AppState from, AppState to) {
  // Same state = no-op, always allowed
  if (from.runtimeType == to.runtimeType) return true;

  // Splash: can go anywhere on first launch
  if (from is Splash) {
    return to is LegalGate ||
        to is PermissionsGate ||
        to is AuthFlow ||
        to is PreDashboard ||
        to is HangTight ||
        to is ActiveDashboard;
  }

  // Legal gate: only forward to PermissionsGate or AuthFlow
  if (from is LegalGate) {
    return to is PermissionsGate || to is AuthFlow;
  }

  // Permissions gate: forward to AuthFlow
  if (from is PermissionsGate) {
    return to is AuthFlow;
  }

  // Auth flow: any sub-step is fine; advancing to Onboarding or directly
  // to PreDashboard / ActiveDashboard is also allowed (skip-onboarding)
  if (from is AuthFlow) {
    return to is AuthFlow ||
        to is Onboarding ||
        to is PreDashboard ||
        to is HangTight ||
        to is ActiveDashboard ||
        to is AccountClosed;
  }

  // Onboarding: any sub-step is fine; advancing to PreDashboard or
  // HangTight is the happy path (older flow vs new active flow). Going
  // back to AuthFlow is not allowed.
  if (from is Onboarding) {
    return to is Onboarding || to is PreDashboard || to is HangTight;
  }

  // Pre-dashboard: can advance to ActiveDashboard, or go BACK to
  // Onboarding (user-cancelled-plan flow). HangTight is a sibling
  // state (new flow's wait surface) — not a transition from pre-dash.
  if (from is PreDashboard) {
    return to is ActiveDashboard || to is Onboarding;
  }

  // PR-ONBOARDING-FLOW-2026-08-11: HangTight is the new flow's wait
  // surface. Forward to ActiveDashboard when the rider becomes active;
  // back to Onboarding on re-KYC / replacement; AccountClosed on admin
  // termination. Polling pauses when leaving.
  if (from is HangTight) {
    return to is ActiveDashboard || to is Onboarding || to is AccountClosed;
  }

  // Active dashboard: can go to AccountClosed, or back to Onboarding
  // (re-KYC flow). Polling pauses when leaving.
  if (from is ActiveDashboard) {
    return to is AccountClosed || to is Onboarding;
  }

  // AccountClosed is terminal — no transitions out.
  return false;
}

/// Returns the list of allowed next-states from [from]. Useful for
/// debugging ("why can't I go from X to Y?") and for documentation
/// generation.
List<AppState> allowedNextStates(AppState from) {
  // We need concrete instances to populate the list. Each state
  // subclasses itself with const constructors, so these are zero-cost.
  final candidates = <AppState>[
    const Splash(),
    const LegalGate(),
    const PermissionsGate(),
    const AuthFlow(AuthStep.phoneEntry),
    const AuthFlow(AuthStep.otpVerify),
    const Onboarding(OnboardingStep.kycSubmit),
    const Onboarding(OnboardingStep.guarantor),
    const Onboarding(OnboardingStep.deposit),
    const Onboarding(OnboardingStep.planSelect),
    const PreDashboard(),
    const HangTight(),
    const ActiveDashboard(),
    const AccountClosed(),
  ];
  return candidates.where((c) => _isAllowed(from, c)).toList();
}

// ── AuthState <-> AppState conversion ──────────────────────────────────

/// Converts legacy [AuthState] enum to modern [AppState] sealed class.
AppState appStateFromAuthState(AuthState authState) {
  switch (authState) {
    case AuthState.splash:
      return const Splash();
    case AuthState.legal:
      return const LegalGate();
    case AuthState.permissions:
      return const PermissionsGate();
    case AuthState.login:
      return const AuthFlow(AuthStep.phoneEntry);
    case AuthState.otp:
      return const AuthFlow(AuthStep.otpVerify);
    case AuthState.userForm:
    case AuthState.kycPreflight:
      return const Onboarding(OnboardingStep.kycSubmit);
    case AuthState.guarantorForm:
      return const Onboarding(OnboardingStep.guarantor);
    case AuthState.choosePlan:
    // PR-ONBOARDING-FLOW-2026-08-13: the Enter Amount screen
    // (topUpAmount) is part of the planSelect onboarding sub-flow.
    // The modern sealed-class state doesn't have a dedicated
    // `deposit` step — the rider-facing UI maps to planSelect.
    case AuthState.topUpAmount:
      return const Onboarding(OnboardingStep.planSelect);
    case AuthState.pickupHub:
    case AuthState.pickupVerification:
      return const Onboarding(OnboardingStep.deposit);
    case AuthState.dashboard:
      return const ActiveDashboard();
    case AuthState.preDashboard:
    case AuthState.intent:
    case AuthState.planSuccess:
    case AuthState.tlDetails:
    case AuthState.rentalDetails:
    case AuthState.endRental:
    case AuthState.faq:
    case AuthState.vehiclePhotos:
    // PR-ONBOARDING-FLOW-2026-08-13: topUpAmount is in the
    // Onboarding(planSelect) case above (it's the Enter Amount
    // screen in the active path). The remaining top-up screens
    // (topUpUpi / topUpProof / topUpReceipt) are dashboard top-up
    // sub-flows that map to PreDashboard as catch-all.
    case AuthState.topUpUpi:
    case AuthState.topUpProof:
    case AuthState.topUpReceipt:
    case AuthState.referralDetails:
    case AuthState.legalPage:
    case AuthState.myDocuments:
      return const PreDashboard();
    case AuthState.hangTight:
      return const HangTight();
    case AuthState.accountClosed:
      return const AccountClosed();
  }
}

/// Converts modern [AppState] sealed class to legacy [AuthState] enum.
AuthState authStateFromAppState(AppState appState) {
  return switch (appState) {
    Splash() => AuthState.splash,
    LegalGate() => AuthState.legal,
    PermissionsGate() => AuthState.permissions,
    AuthFlow(step: AuthStep.phoneEntry) => AuthState.login,
    AuthFlow(step: AuthStep.otpVerify) => AuthState.otp,
    Onboarding(step: OnboardingStep.kycSubmit) => AuthState.userForm,
    Onboarding(step: OnboardingStep.guarantor) => AuthState.guarantorForm,
    // PR-ONBOARDING-FLOW-2026-08-13: the active path maps `planSelect`
    // to the Enter Amount screen (topUpAmount), not the older
    // `choosePlan` screen. The legacy `choosePlan` is preserved in
    // the AuthState enum for any admin tool that still routes a
    // rider there, but the modern state machine is the source of
    // truth and uses `topUpAmount`. This makes the round-trip
    // `topUpAmount → Onboarding(planSelect) → topUpAmount` consistent
    // (previously it drifted to `choosePlan`).
    Onboarding(step: OnboardingStep.planSelect) => AuthState.topUpAmount,
    Onboarding(step: OnboardingStep.deposit) => AuthState.pickupHub,
    PreDashboard() => AuthState.preDashboard,
    HangTight() => AuthState.hangTight,
    ActiveDashboard() => AuthState.dashboard,
    AccountClosed() => AuthState.accountClosed,
  };
}
