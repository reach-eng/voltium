// integration_test/e2e_individual/21_support_faq_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Support – FAQ section is visible', (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'supportTab');

    // FAQ section should be visible
    final hasFaq = find.textContaining('FAQ').evaluate().isNotEmpty ||
        find.textContaining('frequently').evaluate().isNotEmpty ||
        find.byType(ExpansionTile).evaluate().isNotEmpty;

    expect(hasFaq, isTrue, reason: 'Should show FAQ section');
  });
}
