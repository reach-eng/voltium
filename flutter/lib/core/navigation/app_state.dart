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
// Until then, `lib/app/router.dart` continues to use the legacy
// AuthState enum. Both will coexist during the migration window.

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
        to is ActiveDashboard ||
        to is AccountClosed;
  }

  // Onboarding: any sub-step is fine; advancing to PreDashboard is the
  // happy path. Going back to AuthFlow is not allowed.
  if (from is Onboarding) {
    return to is Onboarding || to is PreDashboard;
  }

  // Pre-dashboard: can advance to ActiveDashboard, or go BACK to
  // Onboarding (user-cancelled-plan flow).
  if (from is PreDashboard) {
    return to is ActiveDashboard || to is Onboarding;
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
    const ActiveDashboard(),
    const AccountClosed(),
  ];
  return candidates.where((c) => _isAllowed(from, c)).toList();
}
