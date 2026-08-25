// T-112 (PR-2): the Profile menu now exposes a "Sign out" entry that
// invokes `RiderNotifier.logout()` (the same path the session-expired
// handler uses). The entry point is a top-level `_confirmSignOut`
// helper that shows a confirmation dialog and then triggers the
// logout. The test below verifies the wiring:
//
//   1. The dialog title and body are rendered.
//   2. Tapping Cancel closes the dialog without calling logout().
//   3. Tapping the confirm button calls logout() once.
//
// `logout()` itself is exercised by the existing rider_provider tests
// (see `rider_lifecycle_gate_test.dart`); here we only cover the
// "did the entry point call into the notifier?" contract.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/profile/presentation/screens/profile_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';

void main() {
  group('Profile menu — sign-out entry (T-112)', () {
    testWidgets('Cancel button closes the dialog without calling logout',
        (tester) async {
      int logoutCalls = 0;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            // Pre-seed the notifier with a real rider so the menu renders
            // (otherwise the screen stays in skeleton state and the
            // sign-out entry never appears).
            riderProvider.overrideWith(() {
              return _CountingRiderNotifier(
                  onLogout: () {
                    logoutCalls++;
                  },
                  initialRider: _testRider);
            }),
          ],
          child: const MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: ProfileScreen(),
          ),
        ),
      );
      // Drain async rider build (Profile skeleton → menu).
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 200));

      // Scroll to the sign-out entry — the menu is long and the entry
      // is the last item, so it lives below the fold.
      final signOut = find.byKey(const Key('signOutLink'));
      await tester.scrollUntilVisible(
        signOut,
        200,
        scrollable: find.byType(Scrollable).first,
      );
      expect(signOut, findsOneWidget,
          reason: 'Profile menu must expose a "Sign out" entry');
      await tester.tap(signOut);
      await tester.pumpAndSettle();

      // Dialog visible.
      expect(find.text('Sign out of Voltium?'), findsOneWidget);

      // Tap Cancel.
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      // Dialog gone, no logout invoked.
      expect(find.text('Sign out of Voltium?'), findsNothing);
      expect(logoutCalls, 0,
          reason: 'Cancel must not invoke RiderNotifier.logout()');
    });

    testWidgets('Confirm button invokes RiderNotifier.logout() once',
        (tester) async {
      int logoutCalls = 0;
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            riderProvider.overrideWith(() {
              return _CountingRiderNotifier(
                  onLogout: () {
                    logoutCalls++;
                  },
                  initialRider: _testRider);
            }),
          ],
          child: const MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: ProfileScreen(),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(milliseconds: 200));

      final signOut = find.byKey(const Key('signOutLink'));
      await tester.scrollUntilVisible(
        signOut,
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.tap(signOut);
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('confirmSignOutButton')));
      await tester.pumpAndSettle();

      expect(logoutCalls, 1,
          reason: 'Confirm must invoke RiderNotifier.logout() exactly once');
    });
  });
}

/// Minimal stand-in for the production RiderNotifier that tracks the
/// number of `logout()` invocations. The real notifier drives a
/// multi-step clear (orchestrator + state reset); the entry point we
/// test only cares that `notifier.logout()` was called. Overriding
/// `build()` would re-run the production constructor's polling
/// timer / device-sync init, which we don't need here.
class _CountingRiderNotifier extends RiderNotifier {
  final void Function() onLogout;
  final RiderModel? initialRider;
  _CountingRiderNotifier({required this.onLogout, this.initialRider});

  @override
  RiderState build() {
    // Skip the production PollingManager / device-sync init — none of it
    // is exercised by the sign-out contract. Return a ready state with
    // the test rider so the Profile menu renders.
    if (initialRider == null) return const RiderState();
    return const RiderState().copyWith(
      rider: initialRider,
      dataState: DataState.fresh,
    );
  }

  @override
  Future<void> logout() async {
    onLogout();
    // Skip the real orchestrator / state-reset side effects — this test
    // only covers the entry-point contract.
  }
}

/// A minimal valid rider so the Profile menu renders the (non-skeleton)
/// list of menu items.
final RiderModel _testRider = RiderModel(
  riderId: 'VF-RD-TEST',
  phone: '9876543210',
  name: 'Test Rider',
  pickupDone: true,
  registrationDone: true,
  kycDone: true,
  intent: 'personal',
  guarantorStatus: GuarantorStatus.approved,
  accountStatus: AccountStatus.active,
  lifecycleStatus: 'ACTIVE',
);
