import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/device_compliance/presentation/screens/emergency_contacts_screen.dart';
import 'package:voltium_rider/services/emergency_contacts_service.dart';
import 'package:provider/provider.dart';

Widget buildTestApp() {
  return ChangeNotifierProvider(
    create: (_) => EmergencyContactsService(),
    child: const MaterialApp(home: EmergencyContactsScreen()),
  );
}

void main() {
  group('Emergency Contacts Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.byType(EmergencyContactsScreen), findsOneWidget);
    });

    testWidgets('shows empty state initially', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('No emergency contacts'), findsOneWidget);
    });

    testWidgets('shows add contact button', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Add Contact'), findsOneWidget);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
