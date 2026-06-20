// integration_test/e2e_individual/03_permissions_screen_test.dart
//
// Standalone test: Permissions screen flow.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/03_permissions_screen_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Permissions screen – continue to login', (tester) async {
    await launchApp(tester);
    await handlePreamble(tester);

    final hasLogin = find.byKey(const Key('phoneInput')).evaluate().isNotEmpty;
    final hasDashboard =
        find.byKey(const Key('dashboardTab')).evaluate().isNotEmpty;

    expect(
      hasLogin || hasDashboard,
      isTrue,
      reason: 'Should reach login or dashboard after permissions',
    );
  });
}
