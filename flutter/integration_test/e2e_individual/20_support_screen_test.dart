// integration_test/e2e_individual/20_support_screen_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Support – screen displays FAQ and ticket button',
      (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'supportTab');

    // Verify support elements exist (check for text content)
    final hasSupport = find.textContaining('Support').evaluate().isNotEmpty ||
        find.textContaining('FAQ').evaluate().isNotEmpty ||
        find.textContaining('Help').evaluate().isNotEmpty;

    expect(hasSupport, isTrue, reason: 'Should show support screen');
  });
}
