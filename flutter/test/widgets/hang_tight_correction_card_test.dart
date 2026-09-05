// PR-KYC-CORRECTION (2026-09-06): HangTight's KYC card must show the
// admin-flagged correction fields as chips and a "Correct the details"
// CTA when the rider's KYC is REJECTED or INFO_REQUIRED.

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/dashboard/presentation/screens/hang_tight_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';

class _StubRiderNotifier extends RiderNotifier {
  @override
  RiderState build() => const RiderState();
}

RiderModel _rider({
  KycStatus kycStatus = KycStatus.infoRequired,
  String? rejectionReason = 'Please fix the highlighted fields.',
  List<String>? flaggedFields = const ['fullName', 'aadhaarFront'],
}) =>
    RiderModel(
      riderId: 'VF-RD-TEST',
      phone: '9876543210',
      name: 'Test Rider',
      kycStatus: kycStatus,
      kycRejectionReason: rejectionReason,
      kycEditableFields: flaggedFields,
      lifecycleStatus: 'PICKUP_SCHEDULED',
      accountStatus: AccountStatus.preActive,
    );

class _Harness extends ConsumerStatefulWidget {
  final RiderModel rider;
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
    return HangTightScreen(onFixKyc: widget.onFixKyc);
  }
}

Widget _buildHarness({required RiderModel rider, VoidCallback? onFixKyc}) {
  return ProviderScope(
    overrides: [riderProvider.overrideWith(_StubRiderNotifier.new)],
    child: MaterialApp(
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('hi')],
      home: _Harness(rider: rider, onFixKyc: onFixKyc),
    ),
  );
}

void main() {
  testWidgets(
      'INFO_REQUIRED with flagged fields shows chips + Correct the details',
      (tester) async {
    var fixTapped = false;
    await tester.pumpWidget(_buildHarness(
      rider: _rider(),
      onFixKyc: () => fixTapped = true,
    ));
    await tester.pump();

    // Chips render the admin-flagged fields (label map + aliases).
    expect(find.text('Full name'), findsOneWidget);
    expect(find.text('Aadhaar card (front)'), findsOneWidget);
    // Heading above the chips.
    expect(find.text('Correction needed on:'), findsOneWidget);
    // CTA label (PR-KYC-CORRECTION) on the existing button key.
    expect(find.text('Correct the details'), findsOneWidget);
    expect(find.byKey(const Key('hangTightFixKycButton')), findsOneWidget);

    await tester.tap(find.byKey(const Key('hangTightFixKycButton')));
    await tester.pump();
    expect(fixTapped, isTrue);
  });

  testWidgets('aliases in the flagged list render canonical labels',
      (tester) async {
    await tester.pumpWidget(_buildHarness(
      rider: _rider(flaggedFields: ['name']),
    ));
    await tester.pump();
    expect(find.text('Full name'), findsOneWidget);
  });

  testWidgets(
      'no chips when the admin flagged nothing (remarks-only rejection)',
      (tester) async {
    await tester.pumpWidget(_buildHarness(
      rider: _rider(flaggedFields: null),
    ));
    await tester.pump();
    expect(find.text('Correction needed on:'), findsNothing);
    // The card + CTA still render — the rider can re-enter the form.
    expect(find.text('Correct the details'), findsOneWidget);
  });

  testWidgets('approved KYC renders neither card nor chips', (tester) async {
    await tester.pumpWidget(_buildHarness(
      rider: _rider(kycStatus: KycStatus.approved, flaggedFields: null),
    ));
    await tester.pump();
    expect(find.text('Correct the details'), findsNothing);
    expect(find.text('Correction needed on:'), findsNothing);
  });
}
