// PR-K.1 (2026-08-27): widget tests for the prominent KYC rejection /
// correction card on HangTightScreen. Covers:
//   - Card visibility and styling across KYC statuses (rejected, infoRequired, approved, submitted, null)
//   - "Fix KYC" button tap -> invokes onFixKyc
//   - Status list KYC row tap in attention state -> invokes onFixKyc
//   - Custom rejection reason text vs fallback localized text
//   - Fallback body for infoRequired vs rejected
//   - Hindi localization rendering

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/dashboard/presentation/screens/hang_tight_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';

class _StubRiderNotifier extends RiderNotifier {
  @override
  RiderState build() => const RiderState();

  @override
  Future<void> refreshFromApi() async {
    // No-op for hermetic testing
  }
}

RiderModel _testRider({
  KycStatus kyc = KycStatus.rejected,
  String? rejectionReason,
  bool pickupDone = false,
  String lifecycleStatus = 'PICKUP_SCHEDULED',
}) {
  return RiderModel(
    riderId: 'VF-RD-KYC-TEST',
    phone: '9876543210',
    name: 'Test Rider',
    kycStatus: kyc,
    kycRejectionReason: rejectionReason,
    pickupDone: pickupDone,
    lifecycleStatus: lifecycleStatus,
    accountStatus: AccountStatus.preActive,
  );
}

Widget _buildHarness({
  RiderModel? rider,
  VoidCallback? onFixKyc,
  Locale locale = const Locale('en'),
}) {
  return ProviderScope(
    overrides: [
      riderProvider.overrideWith(_StubRiderNotifier.new),
    ],
    child: MaterialApp(
      locale: locale,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      theme: AppTheme.lightTheme,
      home: _Harness(rider: rider, onFixKyc: onFixKyc),
    ),
  );
}

class _Harness extends ConsumerStatefulWidget {
  final RiderModel? rider;
  final VoidCallback? onFixKyc;

  const _Harness({required this.rider, this.onFixKyc});

  @override
  ConsumerState<_Harness> createState() => _HarnessState();
}

class _HarnessState extends ConsumerState<_Harness> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref.read(riderProvider.notifier).state =
          ref.read(riderProvider).copyWith(rider: widget.rider);
    });
  }

  @override
  Widget build(BuildContext context) {
    return HangTightScreen(
      onFixKyc: widget.onFixKyc,
    );
  }
}

void main() {
  group('HangTightScreen - KYC Rejection / Correction Card (PR-K.1)', () {
    testWidgets('renders rejection card and button when kycStatus is rejected',
        (tester) async {
      await tester.pumpWidget(_buildHarness(
        rider: _testRider(kyc: KycStatus.rejected),
      ));
      await tester.pump();

      expect(find.byKey(const Key('hangTightFixKycButton')), findsOneWidget);
      expect(find.text('KYC rejected'), findsOneWidget);
      expect(find.text('Fix KYC'), findsOneWidget);
      expect(find.byIcon(Icons.error_rounded), findsWidgets);
    });

    testWidgets('renders correction card when kycStatus is infoRequired',
        (tester) async {
      await tester.pumpWidget(_buildHarness(
        rider: _testRider(kyc: KycStatus.infoRequired),
      ));
      await tester.pump();

      expect(find.byKey(const Key('hangTightFixKycButton')), findsOneWidget);
      // HANG-TIGHT-AUDIT P1-3 (2026-09-08): the previous assertion
      // `find.text('KYC rejected')` was the bug — the amber
      // "need more info" card was wearing a red "KYC rejected"
      // title. The card now uses `txtkycInfoRequiredOnHangTightTitle`
      // for the infoRequired variant. The row label below the card
      // also reads "KYC needs more info" (the same ARB key feeds
      // both surfaces), so we expect 2 matches — one in the card,
      // one in the row.
      expect(find.text('KYC needs more info'), findsNWidgets(2));
      expect(find.text('Fix KYC'), findsOneWidget);
      expect(find.byIcon(Icons.help_outline_rounded), findsWidgets);
    });

    testWidgets('does NOT render card when kycStatus is approved',
        (tester) async {
      await tester.pumpWidget(_buildHarness(
        rider: _testRider(kyc: KycStatus.approved),
      ));
      await tester.pump();

      expect(find.byKey(const Key('hangTightFixKycButton')), findsNothing);
      expect(find.text('Fix KYC'), findsNothing);
    });

    testWidgets('does NOT render card when kycStatus is submitted',
        (tester) async {
      await tester.pumpWidget(_buildHarness(
        rider: _testRider(kyc: KycStatus.submitted),
      ));
      await tester.pump();

      expect(find.byKey(const Key('hangTightFixKycButton')), findsNothing);
      expect(find.text('Fix KYC'), findsNothing);
    });

    testWidgets('does NOT render card when rider is null', (tester) async {
      await tester.pumpWidget(_buildHarness(rider: null));
      await tester.pump();

      expect(find.byKey(const Key('hangTightFixKycButton')), findsNothing);
      expect(find.text('Fix KYC'), findsNothing);
    });

    // HANG-TIGHT-AUDIT P1-4 (2026-09-08): `expired` KYC was
    // half-state — the row matrix mapped it to `attention` with a
    // chevron + Fix KYC handler, but the prominent card gate
    // `_isKycAttention` only covered `rejected`/`infoRequired`.
    // An expired-KYC rider got the row and no explanation card.
    // The gate now includes `expired`, and the card uses the
    // existing `hangTightKycExpired` title + the new
    // `hangTightKycExpiredBody` body.
    testWidgets('renders the prominent card when kycStatus is expired',
        (tester) async {
      await tester.pumpWidget(_buildHarness(
        rider: _testRider(kyc: KycStatus.expired),
      ));
      await tester.pump();

      expect(find.byKey(const Key('hangTightFixKycButton')), findsOneWidget,
          reason: 'expired must show the prominent Fix KYC card');
      // HANG-TIGHT-AUDIT P1-4 (2026-09-08): the card title uses
      // the same `hangTightKycExpired` ARB key as the row label
      // below, so we expect 2 matches (one in the card, one in
      // the row). The body text is unique to the card.
      expect(find.text('KYC expired'), findsNWidgets(2));
      expect(find.text('Fix KYC'), findsOneWidget);
      expect(
        find.text(
            'Your KYC has expired. Please re-submit your documents to continue.'),
        findsOneWidget,
      );
      // Expired uses the amber variant (not the red rejected
      // variant), so the icon should be `help_outline`, not
      // `error_rounded`.
      expect(find.byIcon(Icons.help_outline_rounded), findsWidgets);
    });

    testWidgets('tapping Fix KYC button invokes onFixKyc callback',
        (tester) async {
      var called = false;
      await tester.pumpWidget(_buildHarness(
        rider: _testRider(kyc: KycStatus.rejected),
        onFixKyc: () => called = true,
      ));
      await tester.pump();

      final buttonFinder = find.byKey(const Key('hangTightFixKycButton'));
      expect(buttonFinder, findsOneWidget);

      await tester.tap(buttonFinder);
      await tester.pump();

      expect(called, isTrue);
    });

    // HANG-TIGHT-AUDIT P2-5 (2026-09-08): the card button
    // previously disabled when `onFixKyc` was null, but the KYC
    // row's `onTap` (hang_tight_screen.dart:332) fell back to
    // Support. Two null contracts for the same case. The card
    // now matches the row: fall back to Support so the rider
    // still has a path when the KYC flow isn't wired.
    testWidgets(
        'P2-5: Fix KYC button stays enabled (falls back to Support) when onFixKyc is null',
        (tester) async {
      await tester.pumpWidget(_buildHarness(
        rider: _testRider(kyc: KycStatus.rejected),
        // onFixKyc deliberately omitted (null) — the harness
        // default.
      ));
      await tester.pump();

      final buttonFinder = find.byKey(const Key('hangTightFixKycButton'));
      expect(buttonFinder, findsOneWidget);

      // The button widget must have a non-null `onPressed` (the
      // Support fallback). Previously this would be null and the
      // rider would see a disabled button with no recourse.
      final button = tester.widget<FilledButton>(buttonFinder);
      expect(button.onPressed, isNotNull,
          reason:
              'Fix KYC button must fall back to Support when onFixKyc is null');
    });

    testWidgets('tapping KYC status row in attention state invokes onFixKyc',
        (tester) async {
      var called = false;
      await tester.pumpWidget(_buildHarness(
        rider: _testRider(kyc: KycStatus.rejected),
        onFixKyc: () => called = true,
      ));
      await tester.pump();

      final rowFinder = find.text('KYC rejected — please resubmit');
      expect(rowFinder, findsOneWidget);

      await tester.ensureVisible(rowFinder);
      await tester.pump();
      await tester.tap(rowFinder);
      await tester.pump();

      expect(called, isTrue);
    });

    testWidgets('displays custom rejection reason when present',
        (tester) async {
      const customReason = 'Aadhaar back image is blurry. Please re-upload.';
      await tester.pumpWidget(_buildHarness(
        rider: _testRider(
          kyc: KycStatus.rejected,
          rejectionReason: customReason,
        ),
      ));
      await tester.pump();

      expect(find.text(customReason), findsOneWidget);
    });

    testWidgets('displays fallback body for rejected when reason is null',
        (tester) async {
      await tester.pumpWidget(_buildHarness(
        rider: _testRider(
          kyc: KycStatus.rejected,
          rejectionReason: null,
        ),
      ));
      await tester.pump();

      expect(
        find.text(
            'Please review the rejection remarks and re-submit your documents to continue.'),
        findsOneWidget,
      );
    });

    testWidgets('displays fallback body for infoRequired when reason is null',
        (tester) async {
      await tester.pumpWidget(_buildHarness(
        rider: _testRider(
          kyc: KycStatus.infoRequired,
          rejectionReason: null,
        ),
      ));
      await tester.pump();

      expect(
        find.text(
            'We need more information to verify your identity. Please re-submit your documents to continue.'),
        findsOneWidget,
      );
    });

    testWidgets('renders properly in Hindi locale', (tester) async {
      await tester.pumpWidget(_buildHarness(
        rider: _testRider(
          kyc: KycStatus.rejected,
          rejectionReason: null,
        ),
        locale: const Locale('hi'),
      ));
      await tester.pump();

      expect(find.text('KYC अस्वीकृत'), findsOneWidget);
      expect(find.text('KYC ठीक करें'), findsOneWidget);
      expect(
        find.text(
            'कृपया अस्वीकृति के कारणों की समीक्षा करें और अपने दस्तावेज़ फिर से जमा करें।'),
        findsOneWidget,
      );
    });
  });
}
