import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';

/// PR-A (§3.5): the "Skip" action on the guarantor form must not pretend the
/// guarantor is optional. The dialog now says a guarantor is *required* to
/// start renting — the honest consequence — before letting the rider skip.
///
/// ONBOARDING-AUDIT 2026-08-14 (fix #5d): the Skip button has been
/// removed entirely. The reviewer flagged the previous behaviour as
/// dead UI — the button promised a `requiresHigherDeposit` higher
/// tier that the backend never enforced, and skipping the guarantor
/// would block the rental flow at the server. The skip dialog
/// tests below assert functionality that no longer exists; they
/// are kept as `skip: true` markers so anyone re-introducing the
/// flow can flip them back on. To re-introduce skipping, wire the
/// server-side `requiresHigherDeposit` flag end-to-end FIRST.
void main() {
  Widget buildScreen({VoidCallback? onNext}) {
    return ProviderScope(
      child: MaterialApp(
        home: GuarantorOnboardingScreen(onNext: onNext ?? () {}),
      ),
    );
  }

  testWidgets('renders the guarantor form', (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('Guarantor Details'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  // ONBOARDING-AUDIT 2026-08-14 (fix #5d): the Skip button is gone.
  // The three tests below assert behaviour that no longer exists
  // (skip → dialog → confirm/cancel). They are kept as `skip: true`
  // markers so a future re-introduction can flip them back on. To
  // re-enable, wire the server-side `requiresHigherDeposit` flag
  // end-to-end FIRST.
  testWidgets('skip opens a dialog that states the guarantor is required',
      (tester) async {
    // skip: the Skip button was removed (fix #5d). To re-enable,
    // see the file-level comment.
  }, skip: true);

  testWidgets('confirming skip calls onNext', (tester) async {
    // skip: the Skip button was removed (fix #5d). To re-enable,
    // see the file-level comment.
  }, skip: true);

  testWidgets('cancelling the skip dialog does not proceed', (tester) async {
    // skip: the Skip button was removed (fix #5d). To re-enable,
    // see the file-level comment.
  }, skip: true);
}
