// integration_test/e2e_individual/23_support_ticket_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Support – ticket button is visible', (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'supportTab');

    // Ticket button should be visible
    final hasTicket = find.textContaining('Ticket').evaluate().isNotEmpty ||
        find.textContaining('Raise').evaluate().isNotEmpty ||
        find.textContaining('Report').evaluate().isNotEmpty;

    expect(hasTicket, isTrue, reason: 'Should show ticket option');
  });
}
