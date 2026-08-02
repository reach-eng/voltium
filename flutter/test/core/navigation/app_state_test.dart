// R4.1 — State machine transition tests.
// R4.3 — Riverpod StateNotifier tests (appStateProvider).
//
// Locks in the contract:
//   1. Allowed transitions don't throw and return true
//   2. Forbidden transitions throw AppStateError when throwOnForbidden
//   3. The transition table matches the spec in REMEDIATION_PLAN §R4.1
//   4. AccountClosed is terminal
//   5. allowedNextStates returns the expected list for each state
//   6. The Riverpod StateNotifier honors the same transition rules

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/app/app_state.dart';
import 'package:voltium_rider/core/navigation/app_state.dart';
import 'package:voltium_rider/core/navigation/app_state_notifier.dart';

void main() {
  group('AppState transitions (R4.1)', () {
    group('allowed transitions', () {
      test('Splash → any top-level state is allowed', () {
        const splash = Splash();
        expect(isAllowedTransition(splash, const LegalGate()), isTrue);
        expect(isAllowedTransition(splash, const AuthFlow(AuthStep.phoneEntry)),
            isTrue);
        expect(isAllowedTransition(splash, const PreDashboard()), isTrue);
        expect(isAllowedTransition(splash, const ActiveDashboard()), isTrue);
      });

      test('LegalGate → AuthFlow is allowed', () {
        const from = LegalGate();
        expect(isAllowedTransition(from, const AuthFlow(AuthStep.phoneEntry)),
            isTrue);
      });

      test('AuthFlow → Onboarding or PreDashboard/ActiveDashboard is allowed',
          () {
        const from = AuthFlow(AuthStep.phoneEntry);
        expect(
            isAllowedTransition(
                from, const Onboarding(OnboardingStep.kycSubmit)),
            isTrue);
        expect(isAllowedTransition(from, const PreDashboard()), isTrue);
        expect(isAllowedTransition(from, const ActiveDashboard()), isTrue);
        expect(isAllowedTransition(from, const AccountClosed()), isTrue);
      });

      test('Onboarding → PreDashboard is allowed', () {
        const from = Onboarding(OnboardingStep.kycSubmit);
        expect(isAllowedTransition(from, const PreDashboard()), isTrue);
      });

      test('PreDashboard → ActiveDashboard is allowed', () {
        const from = PreDashboard();
        expect(isAllowedTransition(from, const ActiveDashboard()), isTrue);
      });

      test('PreDashboard → Onboarding is allowed (re-plan flow)', () {
        const from = PreDashboard();
        expect(
            isAllowedTransition(
                from, const Onboarding(OnboardingStep.planSelect)),
            isTrue);
      });

      test('ActiveDashboard → AccountClosed is allowed', () {
        const from = ActiveDashboard();
        expect(isAllowedTransition(from, const AccountClosed()), isTrue);
      });

      test('same state is always allowed (no-op)', () {
        const from = ActiveDashboard();
        expect(isAllowedTransition(from, const ActiveDashboard()), isTrue);
      });
    });

    group('forbidden transitions', () {
      test('LegalGate → ActiveDashboard is forbidden (skip auth)', () {
        const from = LegalGate();
        expect(isAllowedTransition(from, const ActiveDashboard()), isFalse);
      });

      test('AuthFlow → Splash is forbidden (no going back)', () {
        const from = AuthFlow(AuthStep.otpVerify);
        expect(isAllowedTransition(from, const Splash()), isFalse);
      });

      test('Onboarding → Splash is forbidden', () {
        const from = Onboarding(OnboardingStep.guarantor);
        expect(isAllowedTransition(from, const Splash()), isFalse);
      });

      test('AccountClosed is terminal — no transitions out', () {
        const from = AccountClosed();
        expect(isAllowedTransition(from, const ActiveDashboard()), isFalse);
        expect(isAllowedTransition(from, const PreDashboard()), isFalse);
        expect(isAllowedTransition(from, const Splash()), isFalse);
        expect(isAllowedTransition(from, const AuthFlow(AuthStep.phoneEntry)),
            isFalse);
      });
    });

    group('throwOnForbidden behaviour', () {
      test('forbidden transition throws AppStateError with from/to', () {
        const from = AccountClosed();
        const to = ActiveDashboard();
        expect(
          () => isAllowedTransition(from, to, throwOnForbidden: true),
          throwsA(
            isA<AppStateError>()
                .having((e) => e.from, 'from', from)
                .having((e) => e.to, 'to', to),
          ),
        );
      });

      test('allowed transition does not throw even with throwOnForbidden', () {
        const from = Splash();
        const to = AuthFlow(AuthStep.phoneEntry);
        expect(
          () => isAllowedTransition(from, to, throwOnForbidden: true),
          returnsNormally,
        );
      });
    });

    group('allowedNextStates helper', () {
      test(
          'Splash can go to LegalGate, PermissionsGate, AuthFlow, PreDashboard, ActiveDashboard',
          () {
        final allowed = allowedNextStates(const Splash());
        expect(allowed, contains(const LegalGate()));
        expect(allowed, contains(const PermissionsGate()));
        expect(allowed, contains(const AuthFlow(AuthStep.phoneEntry)));
        expect(allowed, contains(const PreDashboard()));
        expect(allowed, contains(const ActiveDashboard()));
        // Splash cannot go directly to Onboarding (must go through auth)
        expect(allowed,
            isNot(contains(const Onboarding(OnboardingStep.kycSubmit))));
      });

      test('AccountClosed has no allowed next states (terminal)', () {
        final allowed = allowedNextStates(const AccountClosed());
        // No-op is always allowed, so AccountClosed → AccountClosed is
        // in the list. But no *different* state is allowed (terminal).
        expect(allowed.length, 1);
        expect(allowed.first.runtimeType, AccountClosed);
      });
    });

    group('state identity', () {
      test('state classes are properly sealed (exhaustive switch in Dart 3)',
          () {
        // This test ensures the sealed class compiles cleanly.
        AppState s = const ActiveDashboard();
        final name = switch (s) {
          Splash() => 'splash',
          LegalGate() => 'legal',
          PermissionsGate() => 'permissions',
          AuthFlow() => 'auth',
          Onboarding() => 'onboarding',
          PreDashboard() => 'pre',
          ActiveDashboard() => 'active',
          AccountClosed() => 'closed',
        };
        expect(name, 'active');
      });
    });
  });

  // ── R4.3 ── Riverpod StateNotifier integration ────────────────────────
  group('AppStateNotifier (R4.3)', () {
    test('starts at Splash', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      expect(container.read(appStateProvider), isA<Splash>());
    });

    test('transitionTo: Splash → LegalGate succeeds and updates state', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(appStateProvider.notifier);

      notifier.transitionTo(const LegalGate());
      expect(container.read(appStateProvider), isA<LegalGate>());
    });

    test('transitionTo: rejects forbidden jump with AppStateError', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(appStateProvider.notifier);

      // Splash → Onboarding is not allowed (must go through auth first).
      expect(
        () => notifier.transitionTo(const Onboarding(OnboardingStep.kycSubmit)),
        throwsA(isA<AppStateError>()),
      );
      // State should not have changed.
      expect(container.read(appStateProvider), isA<Splash>());
    });

    test('replaceState: same-family step transitions succeed', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(appStateProvider.notifier);

      notifier.transitionTo(const AuthFlow(AuthStep.phoneEntry));
      notifier.replaceState(const AuthFlow(AuthStep.otpVerify));
      expect(
        container.read(appStateProvider),
        const AuthFlow(AuthStep.otpVerify),
      );
    });

    test('reset(): returns to Splash', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      final notifier = container.read(appStateProvider.notifier);

      notifier.transitionTo(const LegalGate());
      notifier.reset();
      expect(container.read(appStateProvider), isA<Splash>());
    });

    group('AuthState <-> AppState conversions (R4.4)', () {
      test('appStateFromAuthState maps all AuthState enum values to AppState',
          () {
        expect(appStateFromAuthState(AuthState.splash), isA<Splash>());
        expect(appStateFromAuthState(AuthState.legal), isA<LegalGate>());
        expect(appStateFromAuthState(AuthState.permissions),
            isA<PermissionsGate>());
        expect(appStateFromAuthState(AuthState.login),
            const AuthFlow(AuthStep.phoneEntry));
        expect(appStateFromAuthState(AuthState.otp),
            const AuthFlow(AuthStep.otpVerify));
        expect(appStateFromAuthState(AuthState.userForm),
            const Onboarding(OnboardingStep.kycSubmit));
        expect(appStateFromAuthState(AuthState.guarantorForm),
            const Onboarding(OnboardingStep.guarantor));
        expect(
            appStateFromAuthState(AuthState.dashboard), isA<ActiveDashboard>());
        expect(
            appStateFromAuthState(AuthState.preDashboard), isA<PreDashboard>());
        expect(appStateFromAuthState(AuthState.accountClosed),
            isA<AccountClosed>());
      });

      test(
          'authStateFromAppState maps AppState sealed classes back to AuthState',
          () {
        expect(authStateFromAppState(const Splash()), AuthState.splash);
        expect(authStateFromAppState(const LegalGate()), AuthState.legal);
        expect(authStateFromAppState(const PermissionsGate()),
            AuthState.permissions);
        expect(authStateFromAppState(const AuthFlow(AuthStep.phoneEntry)),
            AuthState.login);
        expect(authStateFromAppState(const AuthFlow(AuthStep.otpVerify)),
            AuthState.otp);
        expect(
            authStateFromAppState(const Onboarding(OnboardingStep.kycSubmit)),
            AuthState.userForm);
        expect(
            authStateFromAppState(const Onboarding(OnboardingStep.guarantor)),
            AuthState.guarantorForm);
        expect(authStateFromAppState(const ActiveDashboard()),
            AuthState.dashboard);
        expect(authStateFromAppState(const PreDashboard()),
            AuthState.preDashboard);
        expect(authStateFromAppState(const AccountClosed()),
            AuthState.accountClosed);
      });
    });
  });
}
