import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/app/app_state.dart';
import 'package:voltium_rider/core/navigation/app_state.dart' as nav_state;
import 'package:voltium_rider/core/navigation/app_state_notifier.dart';

void main() {
  group('Router State Machine Transitions', () {
    test('AppState from AuthState conversion mapping is exhaustive', () {
      for (final authState in AuthState.values) {
        final appState = nav_state.appStateFromAuthState(authState);
        expect(appState, isNotNull);
      }
    });

    test('AppState to AuthState roundtrip maps consistently', () {
      const statesToVerify = [
        AuthState.splash,
        AuthState.legal,
        AuthState.permissions,
        AuthState.login,
        AuthState.otp,
        AuthState.userForm,
        AuthState.guarantorForm,
        AuthState.topUpAmount,
        AuthState.pickupHub,
        AuthState.hangTight,
        AuthState.dashboard,
        AuthState.accountClosed,
      ];

      for (final state in statesToVerify) {
        final appState = nav_state.appStateFromAuthState(state);
        final roundtripped = nav_state.authStateFromAppState(appState);
        expect(roundtripped, equals(state));
      }
    });

    test('AppStateNotifier updates state with replaceState', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      expect(container.read(appStateProvider), isA<nav_state.Splash>());

      container.read(appStateProvider.notifier).replaceState(
            const nav_state.AuthFlow(nav_state.AuthStep.phoneEntry),
          );
      expect(
        container.read(appStateProvider),
        equals(const nav_state.AuthFlow(nav_state.AuthStep.phoneEntry)),
      );

      container.read(appStateProvider.notifier).replaceState(
            const nav_state.ActiveDashboard(),
          );
      expect(
        container.read(appStateProvider),
        equals(const nav_state.ActiveDashboard()),
      );
    });
  });
}
