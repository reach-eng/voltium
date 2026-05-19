// integration_test/e2e_individual/22_support_chat_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Support – chat input is visible', (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'supportTab');

    // Chat input should be visible
    final hasChat = find.byType(TextField).evaluate().isNotEmpty ||
        find.textContaining('Message').evaluate().isNotEmpty ||
        find.textContaining('Chat').evaluate().isNotEmpty;

    expect(hasChat, isTrue, reason: 'Should show chat input');
  });
}
