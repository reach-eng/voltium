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
import 'package:voltium_rider/core/state/riverpod_providers.dart';
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
      expect(find.text('KYC rejected'), findsOneWidget);
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
            'कृपया अस्वीकृति के कारणों की समीक्षा करें और जारी रखने के लिए अपने दस्तावेज़ फिर से जमा करें।'),
        findsOneWidget,
      );
    });
  });
}
