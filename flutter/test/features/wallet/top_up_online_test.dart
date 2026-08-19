import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_proof_screen.dart';

/// PR-A (§3.3 / audit #8 P0-1, P0-2): the "Instant Online Top-Up" option was
/// removed because it launched a hardcoded Razorpay URL that 404s (no signed
/// order_id) and the backend has no order-init/webhook. Only Cash and UPI
/// (manual admin verification) remain.
void main() {
  Widget buildScreen() {
    return ProviderScope(
      child: const MaterialApp(
        home: TopUpProofScreen(amount: 2000),
      ),
    );
  }

  testWidgets('offers Cash, UPI, and Instant payment methods', (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('SELECT PAYMENT METHOD'), findsOneWidget);
    expect(find.text('Cash'), findsOneWidget);
    expect(find.text('UPI'), findsOneWidget);
    expect(find.text('Instant'), findsOneWidget);
  });

  testWidgets('has instant payment option pointing to active gateway',
      (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Instant'), findsOneWidget);
    expect(find.textContaining('Razorpay'), findsNothing);
    expect(find.textContaining('Card'), findsNothing);
  });

  testWidgets('explains manual verification honestly', (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 300));

    expect(
      find.textContaining('Payments are verified manually', findRichText: true),
      findsOneWidget,
    );
  });
}
