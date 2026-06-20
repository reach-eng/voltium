import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/device_compliance/presentation/screens/emergency_sos_screen.dart';

Widget buildTestApp() {
  return const MaterialApp(home: EmergencySOSScreen());
}

void main() {
  group('Emergency SOS Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.byType(EmergencySOSScreen), findsOneWidget);
    });

    testWidgets('displays emergency SOS heading', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Emergency SOS'), findsAtLeastNWidgets(1));
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
