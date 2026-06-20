import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/pickup_success_screen.dart';

Widget buildTestApp() {
  return MaterialApp(
    home: PickupSuccessScreen(onFinish: () {}),
  );
}

void main() {
  group('Pickup Success Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.byType(PickupSuccessScreen), findsOneWidget);
    });

    testWidgets('displays success message', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text("You're Live!"), findsOneWidget);
    });

    testWidgets('shows go to dashboard button', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Go to Dashboard'), findsOneWidget);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
