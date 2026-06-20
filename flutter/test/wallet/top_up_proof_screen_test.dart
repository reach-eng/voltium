import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_proof_screen.dart';

Widget buildTestApp() {
  return MaterialApp(
    home: TopUpProofScreen(amount: 500),
  );
}

void main() {
  group('Top Up Proof Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.byType(TopUpProofScreen), findsOneWidget);
    });

    testWidgets('displays step info', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Step 3 of 3'), findsOneWidget);
    });

    testWidgets('shows upload proof title', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Upload Proof'), findsOneWidget);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
