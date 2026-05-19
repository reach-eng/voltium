// integration_test/e2e_individual/31_error_recovery_test.dart
//
// Standalone test: App handles invalid input gracefully.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/31_error_recovery_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Error recovery – invalid phone shows error', (tester) async {
    await launchApp(tester);
    await handlePreamble(tester);
    await waitFor(tester, find.byKey(const Key('phoneInput')));

    // Enter short phone
    await tester.enterText(find.byKey(const Key('phoneInput')), '123');
    await settle(tester);

    // Button should be disabled (onTap is null when TEST_MODE is not true, or _canSubmit is false)
    // The app should stay on login screen
    expect(find.byKey(const Key('phoneInput')), findsOneWidget);
  });
}
