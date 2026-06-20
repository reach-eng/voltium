// integration_test/e2e_individual/33_onboarding_referral_logout_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Journey – full flow completes', (tester) async {
    await fullLoginFlow(tester);
    await expectOnDashboard(tester);

    // Profile tab accessible
    await navigateToTab(tester, 'profileTab');
    final hasProfile = find.textContaining('Profile').evaluate().isNotEmpty ||
        find.byType(ListView).evaluate().isNotEmpty;

    expect(hasProfile, isTrue, reason: 'Should show profile');
  });
}
