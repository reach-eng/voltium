import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_receipt_screen.dart';

/// PR-A (§3.4): the top-up proof flow must land the rider on the receipt
/// screen (was missing from the nav graph). The receipt explains that
/// verification is manual and returns to the dashboard.
void main() {
  Widget buildScreen({VoidCallback? onBackToDashboard}) {
    return MaterialApp(
      home: TopUpReceiptScreen(
        amount: 2000,
        purpose: 'TOP_UP',
        onBackToDashboard: onBackToDashboard ?? () {},
      ),
    );
  }

  testWidgets('renders the payment-submitted receipt', (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump(const Duration(milliseconds: 1200));

    expect(find.text('Payment Submitted'), findsOneWidget);
    expect(find.text('Verification in Progress'), findsOneWidget);
    // Amount is formatted with thousands separators (rendered in a RichText).
    expect(
      find.textContaining('2,000', findRichText: true),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('Back to Dashboard fires the callback', (tester) async {
    var popped = false;
    await tester.pumpWidget(buildScreen(onBackToDashboard: () {
      popped = true;
    }));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump(const Duration(milliseconds: 1200));

    await tester.tap(find.text('Back to Dashboard'));
    await tester.pump();

    expect(popped, isTrue);
  });
}
