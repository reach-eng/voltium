// integration_test/e2e_individual/15_profile_edit_test.dart
//
// Standalone test: Navigate to profile edit and verify form fields.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/15_profile_edit_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Profile – edit screen navigates and displays', (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'profileTab');

    // Tap edit profile
    await tester.tap(find.byKey(const Key('editProfileLink')));
    await settle(tester);
    await tester.pump(const Duration(seconds: 1));

    // Verify edit screen is shown (check for any edit field)
    final hasEditScreen =
        find.byKey(const Key('editFullNameField')).evaluate().isNotEmpty ||
            find.textContaining('Full Name').evaluate().isNotEmpty ||
            find.textContaining('Edit Profile').evaluate().isNotEmpty;

    expect(hasEditScreen, isTrue, reason: 'Should reach edit profile screen');

    // Go back
    await goBack(tester);

    // Should return to profile
    expect(find.byKey(const Key('logoutButton')), findsOneWidget);
  });
}
