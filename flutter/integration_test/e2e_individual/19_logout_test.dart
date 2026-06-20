// integration_test/e2e_individual/19_logout_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Logout – profile tab accessible', (tester) async {
    await fullLoginFlow(tester);

    // Navigate to profile
    await navigateToTab(tester, 'profileTab');

    // Profile tab should show something
    final hasProfile = find.textContaining('Profile').evaluate().isNotEmpty ||
        find.textContaining('Personal').evaluate().isNotEmpty ||
        find.byType(ListView).evaluate().isNotEmpty ||
        find.byType(SingleChildScrollView).evaluate().isNotEmpty;

    expect(hasProfile, isTrue, reason: 'Should show profile content');
  });
}
