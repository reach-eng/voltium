import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_receipt_screen.dart';

Widget buildTestApp() {
  return MaterialApp(
    home: TopUpReceiptScreen(amount: 500, purpose: 'TOP_UP'),
  );
}

void main() {
  group('Top Up Receipt Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      // Use pump with duration instead of pumpAndSettle because
      // the screen has a repeating AnimationController (glow ring).
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.byType(TopUpReceiptScreen), findsOneWidget);
    });

    testWidgets('displays payment submitted after animation', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(milliseconds: 1200));
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('Payment Submitted'), findsOneWidget);
    });

    testWidgets('shows back to dashboard button', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(milliseconds: 1500));

      expect(find.text('Back to Dashboard'), findsOneWidget);
    });

    testWidgets('does not throw', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump();

      expect(tester.takeException(), isNull);
    });
  });
}
