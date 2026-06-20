import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/signature_pad_screen.dart';

Widget buildTestApp() {
  return const MaterialApp(home: SignaturePadScreen());
}

void main() {
  group('Signature Pad Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.byType(SignaturePadScreen), findsOneWidget);
    });

    testWidgets('displays draw signature title', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Draw Signature'), findsOneWidget);
    });

    testWidgets('shows clear and save buttons', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Clear'), findsOneWidget);
      expect(find.text('Save'), findsOneWidget);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
