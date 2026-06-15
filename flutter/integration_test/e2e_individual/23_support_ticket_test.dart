// integration_test/e2e_individual/23_support_ticket_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Support – can type in description and raise ticket', (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'supportTab');

    // Tap on description field
    final descField = find.byKey(const Key('ticketDescriptionField'));
    expect(descField, findsOneWidget);

    await tester.tap(descField);
    await tester.pumpAndSettle();

    // Type in description field
    await tester.enterText(descField, 'This is a test description');
    await tester.pumpAndSettle();

    // Verify text is entered
    expect(find.text('This is a test description'), findsOneWidget);

    // Tap Raise Ticket button
    final raiseBtn = find.byKey(const Key('raiseTicketButton'));
    expect(raiseBtn, findsOneWidget);
    await tester.tap(raiseBtn);
    await tester.pumpAndSettle(const Duration(seconds: 2));
  });
}
