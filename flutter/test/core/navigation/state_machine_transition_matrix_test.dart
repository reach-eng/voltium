// R4.6 — Exhaustive AppState Transition Matrix & Edge Case Security Tests.
// Tests all 64 pairwise combinations of AppState transitions (8 states x 8 states)
// plus inner step transitions for AuthFlow and Onboarding to verify sealed class safety,
// throwOnForbidden error reporting, and Riverpod appStateProvider notifier state flow.

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/app/app_state.dart';
import 'package:voltium_rider/core/navigation/app_state.dart';
import 'package:voltium_rider/core/navigation/app_state_notifier.dart';

void main() {
  group('R4.6: Exhaustive AppState Transition Matrix (8x8)', () {
    final sampleStates = <String, AppState>{
      'Splash': const Splash(),
      'LegalGate': const LegalGate(),
      'PermissionsGate': const PermissionsGate(),
      'AuthFlow': const AuthFlow(AuthStep.phoneEntry),
      'Onboarding': const Onboarding(OnboardingStep.kycSubmit),
      'PreDashboard': const PreDashboard(),
      'ActiveDashboard': const ActiveDashboard(),
      'AccountClosed': const AccountClosed(),
    };

    final allowedPairs = <String>{
      // Same-state self transitions (always allowed as no-ops)
      'Splash -> Splash',
      'LegalGate -> LegalGate',
      'PermissionsGate -> PermissionsGate',
      'AuthFlow -> AuthFlow',
      'Onboarding -> Onboarding',
      'PreDashboard -> PreDashboard',
      'ActiveDashboard -> ActiveDashboard',
      'AccountClosed -> AccountClosed',

      // From Splash
      'Splash -> LegalGate',
      'Splash -> PermissionsGate',
      'Splash -> AuthFlow',
      'Splash -> PreDashboard',
      'Splash -> ActiveDashboard',

      // From LegalGate
      'LegalGate -> PermissionsGate',
      'LegalGate -> AuthFlow',

      // From PermissionsGate
      'PermissionsGate -> AuthFlow',

      // From AuthFlow
      'AuthFlow -> Onboarding',
      'AuthFlow -> PreDashboard',
      'AuthFlow -> ActiveDashboard',
      'AuthFlow -> AccountClosed',

      // From Onboarding
      'Onboarding -> PreDashboard',

      // From PreDashboard
      'PreDashboard -> ActiveDashboard',
      'PreDashboard -> Onboarding',

      // From ActiveDashboard
      'ActiveDashboard -> AccountClosed',
      'ActiveDashboard -> Onboarding',
    };

    for (final entryFrom in sampleStates.entries) {
      for (final entryTo in sampleStates.entries) {
        final key = '${entryFrom.key} -> ${entryTo.key}';
        final expectedAllowed = allowedPairs.contains(key);

        test('Matrix [$key] is ${expectedAllowed ? "ALLOWED" : "FORBIDDEN"}',
            () {
          final isAllowed = isAllowedTransition(entryFrom.value, entryTo.value);
          expect(isAllowed, expectedAllowed,
              reason:
                  'Transition $key expected $expectedAllowed but got $isAllowed');

          if (expectedAllowed) {
            expect(
              () => isAllowedTransition(
                entryFrom.value,
                entryTo.value,
                throwOnForbidden: true,
              ),
              returnsNormally,
            );
          } else {
            expect(
              () => isAllowedTransition(
                entryFrom.value,
                entryTo.value,
                throwOnForbidden: true,
              ),
              throwsA(isA<AppStateError>().having(
                (e) => e.toString(),
                'toString()',
                contains(entryFrom.value.runtimeType.toString()),
              )),
            );
          }
        });
      }
    }
  });

  group('R4.6: AuthFlow & Onboarding Step Sub-State Transitions', () {
    test('AuthFlow step replacements (phoneEntry -> otpVerify)', () {
      const step1 = AuthFlow(AuthStep.phoneEntry);
      const step2 = AuthFlow(AuthStep.otpVerify);

      expect(isAllowedTransition(step1, step2), isTrue);
    });

    test('Onboarding step replacements across all defined onboarding steps',
        () {
      final steps =
          OnboardingStep.values.map((step) => Onboarding(step)).toList();

      for (var i = 0; i < steps.length - 1; i++) {
        final current = steps[i];
        final next = steps[i + 1];
        expect(isAllowedTransition(current, next), isTrue);
      }
    });

    test('Re-plan flow from PreDashboard back to Onboarding(planSelect)', () {
      const preDash = PreDashboard();
      const planSelect = Onboarding(OnboardingStep.planSelect);

      expect(isAllowedTransition(preDash, planSelect), isTrue);
    });

    test('Re-KYC flow from ActiveDashboard back to Onboarding(kycSubmit)', () {
      const activeDash = ActiveDashboard();
      const kyc = Onboarding(OnboardingStep.kycSubmit);

      expect(isAllowedTransition(activeDash, kyc), isTrue);
    });
  });

  group('R4.6: AppStateNotifier Riverpod Integration & Security Edge Cases',
      () {
    late ProviderContainer container;

    setUp(() {
      container = ProviderContainer();
    });

    tearDown(() {
      container.dispose();
    });

    test('AppStateNotifier enforces allowed matrix transitions', () {
      final notifier = container.read(appStateProvider.notifier);

      expect(container.read(appStateProvider), isA<Splash>());

      // Splash -> AuthFlow
      notifier.transitionTo(const AuthFlow(AuthStep.phoneEntry));
      expect(container.read(appStateProvider), isA<AuthFlow>());

      // AuthFlow -> Onboarding
      notifier.transitionTo(const Onboarding(OnboardingStep.kycSubmit));
      expect(container.read(appStateProvider), isA<Onboarding>());

      // Onboarding -> PreDashboard
      notifier.transitionTo(const PreDashboard());
      expect(container.read(appStateProvider), isA<PreDashboard>());

      // PreDashboard -> ActiveDashboard
      notifier.transitionTo(const ActiveDashboard());
      expect(container.read(appStateProvider), isA<ActiveDashboard>());

      // ActiveDashboard -> AccountClosed
      notifier.transitionTo(const AccountClosed());
      expect(container.read(appStateProvider), isA<AccountClosed>());
    });

    test('AppStateNotifier throws AppStateError when attempting forbidden jump',
        () {
      final notifier = container.read(appStateProvider.notifier);

      // Splash -> AuthFlow
      notifier.transitionTo(const AuthFlow(AuthStep.phoneEntry));

      // Attempt AuthFlow -> Splash (forbidden jump back)
      expect(
        () => notifier.transitionTo(const Splash()),
        throwsA(isA<AppStateError>()),
      );

      // State remains AuthFlow
      expect(container.read(appStateProvider), isA<AuthFlow>());
    });

    test(
        'replaceState allows same step replacements without matrix check failure',
        () {
      final notifier = container.read(appStateProvider.notifier);

      notifier.transitionTo(const AuthFlow(AuthStep.phoneEntry));
      notifier.replaceState(const AuthFlow(AuthStep.otpVerify));

      final state = container.read(appStateProvider);
      expect(state, isA<AuthFlow>());
      expect((state as AuthFlow).step, AuthStep.otpVerify);
    });

    test('AccountClosed state blocks transitionTo to different state', () {
      final notifier = container.read(appStateProvider.notifier);

      notifier.replaceState(const AccountClosed());

      expect(
        () => notifier.transitionTo(const ActiveDashboard()),
        throwsA(isA<AppStateError>()),
      );

      expect(container.read(appStateProvider), isA<AccountClosed>());
    });
  });
}
