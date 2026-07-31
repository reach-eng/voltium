// R4.3 (first sub-step) — Riverpod `appStateProvider` exposing the new
// AppState sealed class via the v3 Notifier API.
//
// The state machine itself (transitions, allowed sets) lives in
// `app_state.dart`. This file is the Riverpod wiring layer.
//
// Why a separate file:
//   - Keeps `app_state.dart` free of any Riverpod / Flutter-Riverpod
//     imports, so it stays testable as a pure Dart class.
//   - Lets future R4.4 (auth-flow integration) and R4.5 (polling scoping)
//     depend on a single Riverpod entrypoint (`appStateProvider`) rather
//     than recreating the state-management pattern in each module.
//
// Migration plan:
//   R4.3 (this PR) — Riverpod Notifier + provider
//   R4.4 — AuthRepositoryImpl.verifyOtp returns the new AppState
//   R4.5 — PollingManager instances are scoped to specific states
//   R4.6 — go_router consumes the provider; the existing AppRouter
//          switch-statement is replaced with declarative routes.

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'app_state.dart';

/// Holds the current top-level [AppState] for the running app. All
/// transitions go through [transitionTo] which delegates to
/// [isAllowedTransition] so forbidden jumps raise [AppStateError]
/// rather than silently mutating the state.
class AppStateNotifier extends Notifier<AppState> {
  @override
  AppState build() {
    return const Splash();
  }

  /// Attempt to move the app to [next]. Throws [AppStateError] when
  /// the transition is not allowed by the state machine.
  void transitionTo(AppState next) {
    isAllowedTransition(state, next, throwOnForbidden: true);
    state = next;
  }

  /// Convenience for the very common "advance to a new state of the
  /// same family" case (e.g. AuthFlow(phoneEntry) → AuthFlow(otpVerify)).
  void replaceState(AppState next) {
    state = next;
  }

  /// Reset to the splash state. Used by sign-out flows.
  void reset() {
    state = const Splash();
  }
}

final appStateProvider = NotifierProvider<AppStateNotifier, AppState>(
  AppStateNotifier.new,
);
