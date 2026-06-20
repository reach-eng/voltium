import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:flutter/material.dart';
import 'package:voltium_rider/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Check TEST_MODE skips permissions', (tester) async {
    print('[TEST-CHECK] Starting App');
    await app.main();
    for (int i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    print('[TEST-CHECK] Waiting for splash (4s)');
    await tester.pump(const Duration(seconds: 4));
    for (int i = 0; i < 10; i++) {
      await tester.pump(const Duration(milliseconds: 100));
    }

    const testMode = String.fromEnvironment('TEST_MODE');
    print('[TEST-CHECK] TEST_MODE value: $testMode');

    // If TEST_MODE is true, we should skip Choice/Legal if we want,
    // but AuthWrapper only skips Permissions screen.

    // Let's see what's on screen
    debugDumpApp();
  });
}
