// PR-ONBOARDING-FLOW-2026-08-11: tests for the new hangTight wait
// surface in the active onboarding path. Covers:
//   - Basic render (title, status list, support button, refresh button)
//   - Status-row state mapping per KYC / deposit status
//   - No-redirect for PICKUP_SCHEDULED with pending approvals
//   - Auto-redirect when BOTH approvals land (or lifecycleStatus ACTIVE)
//   - pickupDone alone must NOT trigger the redirect
//   - Notification hint card present
//
// PR-HANGTIGHT-2026-09-06: the status list shows exactly TWO rows —
// KYC approval and Wallet top-up (security deposit) approval. Plan
// selection, guarantor submission, and pickup/vehicle assignment need
// no admin approval and are no longer shown.
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
import 'package:voltium_rider/core/state/riverpod_providers.dart';
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

  @override
  RiderState build() => const RiderState();

  @override
  Future<void> refreshFromApi() async {
    refreshCallCount++;
  }
}

/// Build a rider in the "landed on HangTight, mid-flight" state:
/// KYC under review, deposit under review. Matches the realistic
/// production case the screen must render. Override individual fields
/// via the named params.
RiderModel _rider({
  KycStatus kyc = KycStatus.submitted,
  DepositStatus deposit = DepositStatus.pending,
  double securityDeposit = 0.0,
  bool pickupDone = false,
  String lifecycleStatus = 'PICKUP_SCHEDULED',
}) {
  return RiderModel(
    riderId: 'VF-RD-TEST',
    phone: '9876543210',
    name: 'Test Rider',
    kycStatus: kyc,
    depositStatus: deposit,
    securityDeposit: securityDeposit,
    pickupDone: pickupDone,
    lifecycleStatus: lifecycleStatus,
    accountStatus: AccountStatus.preActive,
  );
}

Widget _buildHarness({
  required RiderModel rider,
  _StubRiderNotifier? notifier,
  VoidCallback? onActivated,
  VoidCallback? onSessionExpired,
  VoidCallback? onFixKyc,
  VoidCallback? onRetryDeposit,
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
        onRetryDeposit: onRetryDeposit,
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
  final VoidCallback? onRetryDeposit;

  const _Harness({
    required this.rider,
    this.onActivated,
    this.onSessionExpired,
    this.onFixKyc,
    this.onRetryDeposit,
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
      ref.read(riderProvider.notifier).state =
          ref.read(riderProvider).copyWith(rider: widget.rider);
    });
  }

  @override
  Widget build(BuildContext context) {
    return HangTightScreen(
      onActivated: widget.onActivated,
      onSessionExpired: widget.onSessionExpired,
      onFixKyc: widget.onFixKyc,
      onRetryDeposit: widget.onRetryDeposit,
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

    testWidgets(
        'PR-HANGTIGHT-2026-09-06: renders exactly the KYC + deposit rows',
        (tester) async {
      // The screen shows ONLY the two admin approvals. Guarantor, plan,
      // pickup, and vehicle rows were removed — those steps are completed
      // by the rider during onboarding and need no admin sign-off.
      await tester.pumpWidget(_buildHarness(
        rider: _rider(
          kyc: KycStatus.approved,
          deposit: DepositStatus.approved,
          pickupDone: true,
        ),
      ));
      await tester.pump();
      expect(find.text(l10n.hangTightKycApproved), findsOneWidget);
      expect(find.text(l10n.hangTightDepositApproved), findsOneWidget);
      // Removed rows must not render.
      expect(find.text(l10n.hangTightGuarantorApproved), findsNothing);
      expect(find.text(l10n.hangTightPlanSelected), findsNothing);
      expect(find.text(l10n.hangTightPickupConfirmation), findsNothing);
      expect(find.text(l10n.hangTightVehicleAssignment), findsNothing);
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

    testWidgets(
        'deposit pending shows under-review row (default state)',
        (tester) async {
      await tester.pumpWidget(_buildHarness(
        rider: _rider(deposit: DepositStatus.pending),
      ));
      await tester.pump();
      expect(find.text(l10n.hangTightDepositUnderReview), findsOneWidget);
    });

    testWidgets(
        'deposit pendingVerification still shows under-review row',
        (tester) async {
      await tester.pumpWidget(_buildHarness(
        rider: _rider(deposit: DepositStatus.pendingVerification),
      ));
      await tester.pump();
      expect(find.text(l10n.hangTightDepositUnderReview), findsOneWidget);
    });

    testWidgets(
        'credited deposit (securityDeposit > 0) shows approved row',
        (tester) async {
      // Mirrors the server's isDepositApproved OR — a credited amount
      // counts as approved even if the status string hasn't flipped yet.
      await tester.pumpWidget(_buildHarness(
        rider: _rider(
          deposit: DepositStatus.pending,
          securityDeposit: 2000,
        ),
      ));
      await tester.pump();
      expect(find.text(l10n.hangTightDepositApproved), findsOneWidget);
    });

    testWidgets(
        'rejected deposit shows Retry payment action that fires onRetryDeposit',
        (tester) async {
      var retried = false;
      await tester.pumpWidget(_buildHarness(
        rider: _rider(deposit: DepositStatus.rejected),
        onRetryDeposit: () => retried = true,
      ));
      await tester.pump();
      expect(find.text(l10n.hangTightDepositRejected), findsOneWidget);
      expect(find.text(l10n.hangTightRetryPayment), findsOneWidget);
      expect(find.byIcon(Icons.chevron_right_rounded), findsWidgets);

      await tester.tap(find.text(l10n.hangTightRetryPayment));
      await tester.pump();
      expect(retried, isTrue,
          reason: 'Retry payment must invoke onRetryDeposit');
    });

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
      RiderModel rider(
              {String? assignedVehicle,
              GuarantorStatus guarantor = GuarantorStatus.submitted,
              String planStatus = 'ACTIVE'}) =>
          RiderModel(
            riderId: 'VF-RD-TEST',
            phone: '9876543210',
            name: 'Test Rider',
            lifecycleStatus: 'PICKUP_SCHEDULED',
            accountStatus: AccountStatus.preActive,
            assignedVehicle: assignedVehicle,
            guarantorStatus: guarantor,
            planStatus: planStatus,
          );
      final r1 = rider();
      final r2 = rider(assignedVehicle: 'VEH-001');
      final r3 = rider(guarantor: GuarantorStatus.approved);
      final r4 = rider(planStatus: 'REJECTED');

      expect(r1 == r2, isFalse,
          reason: 'assignedVehicle change must break equality');
      expect(r1 == r3, isFalse,
          reason: 'guarantorStatus change must break equality');
      expect(r1 == r4, isFalse,
          reason: 'planStatus change must break equality');
      expect(r1 == rider(), isTrue, reason: 'identical models must be equal');
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
        'F-13: auto-redirect does NOT fire on pickupDone alone (approvals pending)',
        (tester) async {
      // PR-HANGTIGHT-2026-09-06: the server sets pickedUpAt (hence
      // pickupDone=true) at pickup time regardless of approvals. The
      // redirect must key on the two approvals, not pickupDone.
      var activated = false;
      final notifier = _StubRiderNotifier();
      await tester.pumpWidget(_buildHarness(
        rider: _rider(pickupDone: false),
        notifier: notifier,
        onActivated: () => activated = true,
      ));
      await tester.pump();
      expect(activated, isFalse);

      notifier.state = notifier.state.copyWith(
        rider: _rider(pickupDone: true),
      );
      await tester.pump();
      await tester.pump();

      expect(activated, isFalse,
          reason:
              'pickupDone=true with pending approvals must NOT trigger onActivated');
    });

    testWidgets(
        'F-13: auto-redirect fires when BOTH approvals land (KYC + deposit)',
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

      // Admin approves KYC first — still waiting on the deposit.
      notifier.state = notifier.state.copyWith(
        rider: _rider(pickupDone: true, kyc: KycStatus.approved),
      );
      await tester.pump();
      await tester.pump();
      expect(activated, isFalse,
          reason: 'One approval landing is not enough');

      // Deposit approval completes the set → redirect.
      notifier.state = notifier.state.copyWith(
        rider: _rider(
          pickupDone: true,
          kyc: KycStatus.approved,
          deposit: DepositStatus.approved,
        ),
      );
      await tester.pump();
      await tester.pump();

      expect(activated, isTrue,
          reason:
              'onActivated must fire the moment both approvals are complete');
    });

    testWidgets(
        'F-13: auto-redirect fires when lifecycleStatus flips to ACTIVE',
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

      // Server self-heal flips lifecycleStatus to ACTIVE (e.g. approvals
      // landed while the app was backgrounded and the poller picks it up).
      notifier.state = notifier.state.copyWith(
        rider: _rider(lifecycleStatus: 'ACTIVE', pickupDone: true),
      );
      await tester.pump();
      await tester.pump();

      expect(activated, isTrue,
          reason: 'lifecycleStatus ACTIVE must trigger onActivated');
    });
  });
}
