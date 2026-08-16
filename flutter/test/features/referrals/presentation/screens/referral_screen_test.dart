import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/referrals/presentation/screens/referral_screen.dart';
import 'package:voltium_rider/models/rider_model.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for ReferralScreen', (WidgetTester tester) async {
    configureGoldenSurface(tester);

    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(ReferralScreen()));
    await tester.pump(const Duration(seconds: 1));

    await expectLater(
      find.byType(ReferralScreen),
      matchesGoldenFile('goldens/referralscreen_golden.png'),
    );
  });

  // DARK-MODE-AUDIT 2026-08-14 PR3: dark-mode golden counterpart to catch
  // regressions where a static `AppColors.X` (light-only) slips back in.
  testWidgets('Golden test for ReferralScreen (dark mode)',
      (WidgetTester tester) async {
    configureGoldenSurface(tester);

    // ignore: prefer_const_constructors
    await tester
        .pumpWidget(wrapForGolden(ReferralScreen(), themeMode: ThemeMode.dark));
    await tester.pump(const Duration(seconds: 1));

    await expectLater(
      find.byType(ReferralScreen),
      matchesGoldenFile('goldens/referralscreen_golden_dark.png'),
    );
  });

  testWidgets(
      'PR-8: never renders a fake VOLTIUM-XXXX placeholder when the '
      'code has not resolved', (WidgetTester tester) async {
    final notifier = _SeededRiderNotifier(
      const RiderModel(
        id: 'test_rider',
        riderId: 'test_rider',
        name: 'Test Rider',
        phone: '9999999999',
        lifecycleStatus: 'NEW',
      ), // referralCode: null — the P0-7 case
    );

    await tester.pumpWidget(ProviderScope(
      overrides: [riderProvider.overrideWith(() => notifier)],
      child: const MaterialApp(home: ReferralScreen()),
    ));
    // Let the post-frame lazy fetch attempt the (stubbed-out) API call.
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));

    // The skeleton is showing, not a fabricated shareable code.
    expect(find.textContaining('VOLTIUM'), findsNothing);
    expect(find.textContaining('VOLTIUM-XXXX'), findsNothing);
    // No code box rendered — the skeleton replaced it (the stubbed HTTP
    // client fails the lazy fetch, so the retry affordance appears).
    expect(find.byKey(const Key('referralCodeRetry')), findsOneWidget);
  });

  testWidgets(
      'PR-8: fetch failure keeps the skeleton visible with a retry '
      'affordance — still no placeholder', (WidgetTester tester) async {
    final notifier = _SeededRiderNotifier(
      const RiderModel(
        id: 'test_rider',
        riderId: 'test_rider',
        name: 'Test Rider',
        phone: '9999999999',
        lifecycleStatus: 'NEW',
      ),
    );

    await tester.pumpWidget(ProviderScope(
      overrides: [riderProvider.overrideWith(() => notifier)],
      child: const MaterialApp(home: ReferralScreen()),
    ));
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pump(const Duration(milliseconds: 500));

    // The stubbed HTTP client in widget tests fails the fetch → retry.
    expect(find.byKey(const Key('referralCodeRetry')), findsOneWidget);
    expect(find.textContaining('VOLTIUM'), findsNothing);
  });

  testWidgets('PR-8: renders the real code when the rider has one',
      (WidgetTester tester) async {
    final notifier = _SeededRiderNotifier(
      const RiderModel(
        id: 'test_rider',
        riderId: 'test_rider',
        name: 'Test Rider',
        phone: '9999999999',
        lifecycleStatus: 'NEW',
        referralCode: 'VLT-ABCD-1234',
      ),
    );

    await tester.pumpWidget(ProviderScope(
      overrides: [riderProvider.overrideWith(() => notifier)],
      child: const MaterialApp(home: ReferralScreen()),
    ));
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('VLT-ABCD-1234'), findsOneWidget);
    expect(find.textContaining('VOLTIUM-XXXX'), findsNothing);
    // No skeleton.
    expect(find.text('Loading your referral code…'), findsNothing);
  });
}

/// Minimal riderProvider override — mirrors the pattern used by the
/// guarantor onboarding screen tests.
class _SeededRiderNotifier extends RiderNotifier {
  _SeededRiderNotifier(this._seed);
  final RiderModel _seed;

  @override
  RiderState build() => RiderState(
        rider: _seed,
        riderId: _seed.riderId.isNotEmpty ? _seed.riderId : _seed.id,
        phone: _seed.phone,
        dataState: DataState.fresh,
        hasFetchedOnce: true,
      );
}
