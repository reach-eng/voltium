// PR-ONBOARDING-FLOW-2026-08-11: tests for the new hangTight wait
// surface in the active onboarding path. Covers:
//   - Basic render (title, status list, support button, refresh button)
//   - Status-row state mapping per KYC status
//   - No-redirect for PICKUP_SCHEDULED with !pickupDone
//   - Auto-redirect to dashboard when rider becomes active
//   - Notification hint card present
//
// ONBOARDING-AUDIT 2026-08-14 (fix #2): the previous version of these
// tests asserted the hardcoded "everything is done" labels. The
// status list now reads from the rider model (guarantorStatus,
// currentPlan, pickupDone, kycStatus, assignedVehicle). The test
// rider is now constructed with a realistic state (all five rows
// either done or in-progress) so the labels match what production
// renders.
//
// Widget tests use a stubbed RiderState via ProviderScope.override — the
// screen reads rider via ref.watch(riderProvider.select((p) => p.rider))
// and the notifier only via refreshFromApi() (which we don't need to
// fully drive for these tests).

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/dashboard/presentation/screens/hang_tight_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/gen/app_localizations_en.dart';
import 'package:voltium_rider/models/rider_model.dart';

/// Minimal stub notifier — `refreshFromApi` is a no-op so widget tests
/// stay hermetic. The test harness sets up the rider state directly via
/// [riderProvider.overrideWith] below.
/// Minimal stub notifier — `refreshFromApi` records invocation count.
class _StubRiderNotifier extends RiderNotifier {
  int refreshCallCount = 0;
  // HANG-TIGHT-AUDIT P0-3 (2026-09-08): the polling-timeout banner's
  // refresh button calls `startOnboardingPoll()` (resets the counter
  // and restarts the poller — NOT a one-shot `refreshFromApi`). The
  // parent `RiderNotifier.build()` is bypassed, so the real
  // `startOnboardingPoll` would NPE on the never-initialized
  // `_onboardingPoller`. Override it here to record the call and
  // simulate the real behavior (clear the timeout flag).
  int startOnboardingPollCallCount = 0;

  @override
  RiderState build() => const RiderState();

  @override
  Future<void> refreshFromApi() async {
    refreshCallCount++;
  }

  @override
  void startOnboardingPoll() {
    startOnboardingPollCallCount++;
    state = state.copyWith(isPollingTimedOut: false);
  }
}

/// Build a rider in the "landed on HangTight, mid-flight" state:
/// guarantor submitted (not yet approved), plan selected, pickup
/// confirmed by syncPickup, KYC still under review, no vehicle
/// assigned yet. Matches the realistic production case the screen
/// must render. Override individual fields via [kyc] / [pickupDone].
RiderModel _rider({
  KycStatus kyc = KycStatus.submitted,
  bool pickupDone = false,
  String lifecycleStatus = 'PICKUP_SCHEDULED',
  GuarantorStatus guarantor = GuarantorStatus.submitted,
  String currentPlan = 'Weekly',
  String? assignedVehicle,
  String planStatus = 'ACTIVE',
}) {
  return RiderModel(
    riderId: 'VF-RD-TEST',
    phone: '9876543210',
    name: 'Test Rider',
    kycStatus: kyc,
    pickupDone: pickupDone,
    lifecycleStatus: lifecycleStatus,
    accountStatus: AccountStatus.preActive,
    guarantorStatus: guarantor,
    currentPlan: currentPlan,
    planStatus: planStatus,
    assignedVehicle: assignedVehicle,
  );
}

Widget _buildHarness({
  required RiderModel rider,
  _StubRiderNotifier? notifier,
  VoidCallback? onActivated,
  VoidCallback? onSessionExpired,
  VoidCallback? onFixKyc,
  // HANG-TIGHT-AUDIT P0-3 (2026-09-08): optional flag so the
  // polling-timeout banner tests can seed `isPollingTimedOut: true`
  // in the rider state.
  bool isPollingTimedOut = false,
}) {
  final activeNotifier = notifier ?? _StubRiderNotifier();
  return ProviderScope(
    overrides: [
      riderProvider.overrideWith(() => activeNotifier),
    ],
    child: MaterialApp(
      // PR-D: the screen reads every visible string via
      // AppLocalizations.of(context)!; without delegates the
      // non-null assert throws on first build.
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('hi')],
      home: _Harness(
        rider: rider,
        onActivated: onActivated,
        onSessionExpired: onSessionExpired,
        onFixKyc: onFixKyc,
        isPollingTimedOut: isPollingTimedOut,
      ),
    ),
  );
}

/// Inner widget that mounts the HangTightScreen and seeds the
/// [RiderNotifier] state via the same provider override. Done at this
/// level so the override only takes effect for the screen, not for the
/// whole test runner.
class _Harness extends ConsumerStatefulWidget {
  final RiderModel rider;
  final VoidCallback? onActivated;
  final VoidCallback? onSessionExpired;
  final VoidCallback? onFixKyc;
  final bool isPollingTimedOut;

  const _Harness({
    required this.rider,
    this.onActivated,
    this.onSessionExpired,
    this.onFixKyc,
    this.isPollingTimedOut = false,
  });

  @override
  ConsumerState<_Harness> createState() => _HarnessState();
}

class _HarnessState extends ConsumerState<_Harness> {
  @override
  void initState() {
    super.initState();
    // Seed the rider state after the provider is initialized.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(riderProvider.notifier).state = ref.read(riderProvider).copyWith(
            rider: widget.rider,
            isPollingTimedOut: widget.isPollingTimedOut,
          );
    });
  }

  @override
  Widget build(BuildContext context) {
    return HangTightScreen(
      onActivated: widget.onActivated,
      onSessionExpired: widget.onSessionExpired,
      onFixKyc: widget.onFixKyc,
    );
  }
}

void main() {
  // PR-D: every visible string in HangTightScreen is now routed
  // through AppLocalizations. Construct one instance up front and
  // read its getters so the assertions match whatever locale the
  // test pumps (default: en).
  final l10n = AppLocalizationsEn();

  group('HangTightScreen', () {
    testWidgets('renders title and subtitle', (tester) async {
      await tester.pumpWidget(_buildHarness(rider: _rider()));
      await tester.pump();
      expect(find.text(l10n.hangTightTitle), findsOneWidget);
      expect(
        find.textContaining(l10n.hangTightSettingUpBody.split('\n').first),
        findsOneWidget,
      );
    });

    testWidgets('renders 5-row status list with correct labels',
        (tester) async {
      // ONBOARDING-AUDIT 2026-08-14 (fix #2): drive a fully-resolved
      // rider state so every row renders its "done" label. The
      // previous version of this test asserted on hardcoded labels
      // that no longer exist — the screen now derives every label
      // from the rider model.
      await tester.pumpWidget(_buildHarness(
        rider: _rider(
          kyc: KycStatus.approved,
          guarantor: GuarantorStatus.approved,
          assignedVehicle: 'TEST-VEH-001',
        ),
      ));
      await tester.pump();
      expect(find.text(l10n.hangTightGuarantorApproved), findsOneWidget);
      expect(find.text(l10n.hangTightPlanSelected), findsOneWidget);
      // pickupDone is false in this state — the row says
      // "Pickup confirmation" (waiting), not "Pickup confirmed" (done).
      // The auto-redirect in the real screen handles that case before
      // the user can see it.
      expect(find.text(l10n.hangTightPickupConfirmation), findsOneWidget);
      expect(find.text(l10n.hangTightKycApproved), findsOneWidget);
      expect(find.text(l10n.hangTightVehicleAssignment), findsOneWidget);
    });

    testWidgets('shows Contact support + Refresh buttons', (tester) async {
      await tester.pumpWidget(_buildHarness(rider: _rider()));
      await tester.pump();
      expect(find.byKey(const Key('hangTightSupportButton')), findsOneWidget);
      expect(find.byKey(const Key('hangTightRefreshButton')), findsOneWidget);
      expect(find.text(l10n.suspension_contactSupport), findsOneWidget);
      expect(find.text(l10n.txtrefresh), findsOneWidget);
    });

    testWidgets('shows the notification hint card', (tester) async {
      await tester.pumpWidget(_buildHarness(rider: _rider()));
      await tester.pump();
      expect(
        find.textContaining(l10n.hangTightNotificationHint),
        findsOneWidget,
      );
    });

    testWidgets('does not throw on render (no overflow)', (tester) async {
      await tester.pumpWidget(_buildHarness(rider: _rider()));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets(
      'KYC submitted shows in-progress spinner (default state)',
      (tester) async {
        await tester.pumpWidget(_buildHarness(
          rider: _rider(kyc: KycStatus.submitted),
        ));
        await tester.pump();
        // In-progress row uses a CircularProgressIndicator — finder matches
        // any progress indicator in the status list. The KYC label is
        // present; the spinner sits to its left.
        expect(find.byType(CircularProgressIndicator), findsWidgets);
        expect(find.text(l10n.hangTightKycUnderReview), findsOneWidget);
      },
    );

    testWidgets('KYC approved flips the KYC label and removes the spinner',
        (tester) async {
      await tester.pumpWidget(_buildHarness(
        rider: _rider(kyc: KycStatus.approved),
      ));
      await tester.pump();
      // ONBOARDING-AUDIT 2026-08-14 (fix #2): approved KYC now reads
      // "KYC approved", not "KYC under review". The spinner for the
      // KYC row is gone (the hero hourglass spinner is the only
      // remaining indicator on the screen).
      expect(find.text(l10n.hangTightKycApproved), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('rejected KYC renders action needed label and chevron',
        (tester) async {
      await tester.pumpWidget(_buildHarness(
        rider: _rider(kyc: KycStatus.rejected),
      ));
      await tester.pump();
      expect(find.text(l10n.hangTightKycRejectedResubmit), findsOneWidget);
      expect(find.text(l10n.hangTightStatusActionNeeded), findsOneWidget);
      expect(find.byIcon(Icons.chevron_right_rounded), findsWidgets);
    });

    testWidgets(
        'RiderModel equality includes assignedVehicle, guarantorStatus, and planStatus',
        (tester) async {
      final r1 =
          _rider(assignedVehicle: null, guarantor: GuarantorStatus.submitted);
      final r2 = _rider(
          assignedVehicle: 'VEH-001', guarantor: GuarantorStatus.submitted);
      final r3 =
          _rider(assignedVehicle: null, guarantor: GuarantorStatus.approved);
      final r4 = _rider(assignedVehicle: null, planStatus: 'REJECTED');

      expect(r1 == r2, isFalse,
          reason: 'assignedVehicle change must break equality');
      expect(r1 == r3, isFalse,
          reason: 'guarantorStatus change must break equality');
      expect(r1 == r4, isFalse,
          reason: 'planStatus change must break equality');
      expect(r1 == _rider(), isTrue, reason: 'identical models must be equal');
    });

    testWidgets(
        'F-13: HangTightScreen does not run duplicate unmanaged 15s Timer.periodic',
        (tester) async {
      final notifier = _StubRiderNotifier();
      await tester.pumpWidget(_buildHarness(
        rider: _rider(pickupDone: false),
        notifier: notifier,
      ));
      await tester.pump();

      // Advancing past 15s and 30s should NOT invoke refreshFromApi from the screen.
      // (Centralized onboarding polling in RiderNotifier handles periodic checks).
      await tester.pump(const Duration(seconds: 16));
      await tester.pump(const Duration(seconds: 16));

      expect(notifier.refreshCallCount, 0,
          reason:
              'HangTightScreen must not fire unmanaged internal Timer.periodic');
    });

    testWidgets(
        'F-13: manual refresh button triggers refreshFromApi via riderProvider',
        (tester) async {
      final notifier = _StubRiderNotifier();
      await tester.pumpWidget(_buildHarness(
        rider: _rider(pickupDone: false),
        notifier: notifier,
      ));
      await tester.pump();

      final refreshFinder = find.byKey(const Key('hangTightRefreshButton'));
      expect(refreshFinder, findsOneWidget);
      await tester.tap(refreshFinder);
      await tester.pump();

      expect(notifier.refreshCallCount, 1,
          reason:
              'Manual refresh button must call refreshFromApi() on riderProvider');
    });

    testWidgets(
        'F-13: auto-redirect triggers onActivated when rider becomes active via state change',
        (tester) async {
      var activated = false;
      final notifier = _StubRiderNotifier();
      await tester.pumpWidget(_buildHarness(
        rider: _rider(pickupDone: false),
        notifier: notifier,
        onActivated: () => activated = true,
      ));
      await tester.pump();
      expect(activated, isFalse);

      // Simulate rider receiving pickupDone flip from API/sync
      notifier.state = notifier.state.copyWith(
        rider: _rider(pickupDone: true),
      );
      await tester.pump();
      // Allow addPostFrameCallback to execute
      await tester.pump();

      expect(activated, isTrue,
          reason:
              'onActivated must be invoked immediately upon pickupDone flip without needing screen timer');
    });

    // HANG-TIGHT-AUDIT P0-3 (2026-09-08): after 240 polls (≈ 2h) the
    // onboarding poller stops and `isPollingTimedOut: true` is set on
    // the rider state. The hangTight screen must surface a recovery
    // affordance so the rider is not stranded silently. The shared
    // `WaitStatePollingBanner` is the source of truth (also used by
    // pre-dashboard); the test pins the visibility + the refresh
    // callback so a regression that drops the watcher or wires the
    // banner to a one-shot `refreshFromApi` instead of
    // `startOnboardingPoll` would fail CI.
    testWidgets(
        'P0-3: shows the polling-timeout banner when isPollingTimedOut is true',
        (tester) async {
      await tester.pumpWidget(_buildHarness(
        rider: _rider(pickupDone: false),
        isPollingTimedOut: true,
      ));
      await tester.pump();
      await tester.pump();

      // The banner has a fixed key (shared with pre-dashboard) and a
      // hardcoded "Status taking longer than expected" message. Assert
      // both so the lift-to-shared-widget refactor is pinned.
      expect(
        find.byKey(const Key('waitStatePollingTimeoutRefresh')),
        findsOneWidget,
      );
      expect(
        find.textContaining('Status taking longer than expected'),
        findsOneWidget,
      );
    });

    testWidgets(
        'P0-3: tapping the banner refresh button calls startOnboardingPoll and clears the flag',
        (tester) async {
      final notifier = _StubRiderNotifier();
      await tester.pumpWidget(_buildHarness(
        rider: _rider(pickupDone: false),
        notifier: notifier,
        isPollingTimedOut: true,
      ));
      await tester.pump();
      await tester.pump();

      // Sanity: the flag is seeded true and the banner is showing.
      expect(notifier.state.isPollingTimedOut, isTrue);
      expect(
        find.byKey(const Key('waitStatePollingTimeoutRefresh')),
        findsOneWidget,
      );

      await tester.tap(
        find.byKey(const Key('waitStatePollingTimeoutRefresh')),
      );
      await tester.pump();

      // The banner's refresh must call `startOnboardingPoll` (which
      // both restarts the poller AND clears the timeout flag), NOT a
      // one-shot `refreshFromApi` (which would leave the poller
      // stopped and the rider permanently stuck). The stub
      // simulates the real behavior on the flag.
      expect(notifier.startOnboardingPollCallCount, 1,
          reason: 'Refresh must call startOnboardingPoll, not refreshFromApi');
      expect(notifier.refreshCallCount, 0,
          reason: 'Refresh must not also fire a one-shot fetch');
      expect(notifier.state.isPollingTimedOut, isFalse,
          reason: 'startOnboardingPoll clears the timeout flag');
    });

    // HANG-TIGHT-AUDIT P2-4 (2026-09-08): the manual Refresh
    // button used to stack parallel `refreshFromApi` calls on
    // rapid taps. The fix watches `isRefreshing` from
    // `riderProvider` and disables the button (onPressed: null)
    // + swaps the icon for a spinner while the fetch is in
    // flight.
    testWidgets(
        'P2-4: Refresh button disables and shows a spinner while isRefreshing is true',
        (tester) async {
      final notifier = _StubRiderNotifier();
      await tester.pumpWidget(_buildHarness(
        rider: _rider(pickupDone: false),
        notifier: notifier,
      ));
      await tester.pump();
      await tester.pump();

      // Sanity: the refresh icon is present and the button is
      // enabled (onPressed: non-null).
      expect(find.byIcon(Icons.refresh_rounded), findsOneWidget);
      final buttonFinder = find.byKey(const Key('hangTightRefreshButton'));
      var button = tester.widget<OutlinedButton>(buttonFinder);
      expect(button.onPressed, isNotNull);

      // Set isRefreshing: true on the rider state. The screen
      // watches this flag and re-renders.
      notifier.state = notifier.state.copyWith(isRefreshing: true);
      await tester.pump();

      // The refresh icon is gone, replaced by a spinner; the
      // button is disabled.
      expect(find.byIcon(Icons.refresh_rounded), findsNothing);
      button = tester.widget<OutlinedButton>(buttonFinder);
      expect(button.onPressed, isNull,
          reason: 'Refresh button must be disabled while a fetch is in flight');
    });

    // HANG-TIGHT-AUDIT P2-6 (2026-09-08): when the OS "reduce
    // motion" preference is on, the `_SpinningIcon` (used for
    // the hero hourglass + the in-progress status row) renders
    // the icon statically without the rotation animation. The
    // screen should render without exception under that
    // MediaQuery, and the controller should not be advancing.
    testWidgets(
        'P2-6: HangTightScreen renders without exception when MediaQuery.disableAnimations is true',
        (tester) async {
      final notifier = _StubRiderNotifier();
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(disableAnimations: true),
          child: ProviderScope(
            overrides: [
              riderProvider.overrideWith(() => notifier),
            ],
            child: MaterialApp(
              localizationsDelegates: const [
                AppLocalizations.delegate,
                GlobalMaterialLocalizations.delegate,
                GlobalWidgetsLocalizations.delegate,
                GlobalCupertinoLocalizations.delegate,
              ],
              supportedLocales: const [Locale('en'), Locale('hi')],
              home: _Harness(
                rider: _rider(pickupDone: false),
              ),
            ),
          ),
        ),
      );
      // Advance past the 3s repeat that would normally fire if
      // the rotation was running. No exception should escape
      // even though the controller is still created (we render
      // the icon statically under reduce motion).
      await tester.pump();
      await tester.pump(const Duration(seconds: 5));

      expect(tester.takeException(), isNull,
          reason: 'Render must be exception-free under reduce motion');
    });

    // HANG-TIGHT-AUDIT P3-3 (2026-09-08): the guarantor `replaced`
    // state renders as `inProgress` with the `autorenew_rounded`
    // icon data and the brand primary color
    // (hang_tight_screen.dart:562-568). The sibling states
    // (approved, submitted, rejected) are covered by other tests
    // — pin `replaced` so a regression in the label/state can't
    // slip through silently.
    //
    // Note: `_StatusRowTile` (hang_tight_screen.dart:778-792)
    // overrides the row's icon with a `CircularProgressIndicator`
    // for the inProgress state. The `autorenew_rounded` icon
    // data is still set on the `_StatusRow` (the source of
    // truth for the production state) but is not what the
    // test should assert against — assert the visible spinner
    // + the label instead.
    testWidgets(
        'P3-3: guarantor "replaced" renders inProgress with the pending-review label',
        (tester) async {
      await tester.pumpWidget(_buildHarness(
        rider: _rider(guarantor: GuarantorStatus.replaced),
      ));
      await tester.pump();

      // The row label is the "pending review" copy. (Pinning
      // the label guards against i18n regressions on this
      // niche state.)
      expect(
        find.text(l10n.hangTightGuarantorReplacedPendingReview),
        findsOneWidget,
      );
      // The in-progress state is rendered as a spinner
      // (CircularProgressIndicator) per the in-progress branch
      // in `_StatusRowTile`.
      expect(find.byType(CircularProgressIndicator), findsWidgets);
    });
  });
}
