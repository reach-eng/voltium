// integration_test/e2e_individual/14_profile_display_test.dart
//
// Standalone test: Profile screen displays rider information.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/14_profile_display_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Profile – displays rider info and status tiles', (tester) async {
    await fullLoginFlow(tester);
    await navigateToTab(tester, 'profileTab');

    // Profile elements
    expect(find.textContaining('KYC'), findsAtLeastNWidgets(1));
    expect(find.byKey(const Key('editProfileLink')), findsOneWidget);
    expect(find.byKey(const Key('logoutButton')), findsOneWidget);
  });
}
