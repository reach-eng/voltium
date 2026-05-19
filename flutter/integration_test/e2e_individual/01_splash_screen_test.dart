// integration_test/e2e_individual/01_splash_screen_test.dart
//
// Standalone test: Verify splash screen displays correctly.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/01_splash_screen_test.dart -d emulator-5554

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Splash screen displays Voltium branding and auto-navigates',
      (tester) async {
    await resetAppState();
    await safeAppMain();
    // Don't use pumpAndSettle - it waits for splash animations to complete
    await tester.pump(const Duration(milliseconds: 500));

    // Check splash branding (animations start at 200ms, title appears at ~700ms)
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('Voltium'), findsOneWidget);
    expect(find.text('Ride the Future'), findsOneWidget);

    // Wait for splash animation to complete and auto-navigate (~2.5s total)
    await tester.pump(const Duration(seconds: 3));
    await settle(tester);

    // Should reach permissions or login screen
    final possibleScreens = [
      find.byKey(const Key('continuePermissionsButton')),
      find.byKey(const Key('phoneInput')),
    ];

    bool foundScreen = false;
    for (final finder in possibleScreens) {
      if (finder.evaluate().isNotEmpty) {
        foundScreen = true;
        break;
      }
    }
    expect(foundScreen, isTrue,
        reason: 'Splash should auto-navigate to next screen');
  });
}
