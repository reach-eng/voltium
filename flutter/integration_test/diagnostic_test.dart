// integration_test/diagnostic_test.dart
// Quick diagnostic to verify app launches and widgets are findable

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:flutter/material.dart';
import 'package:voltfleet_rider/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Diagnostic – app launches', (tester) async {
    await app.main();
    await tester.pumpAndSettle();
    
    // Wait for splash
    await tester.pump(const Duration(seconds: 4));
    await tester.pumpAndSettle();
    
    // Just verify the app rendered something
    expect(find.byType(MaterialApp), findsOneWidget);
    
    // Try to find login screen elements
    final phoneInput = find.byKey(const Key('phoneInput'));
    if (phoneInput.evaluate().isNotEmpty) {
      print('✅ Found phoneInput key');
    } else {
      print('❌ phoneInput key not found');
      // Dump widget tree for debugging
      debugDumpApp();
    }
    
    // Check for splash screen
    final splash = find.byKey(const Key('splash'));
    if (splash.evaluate().isNotEmpty) {
      print('✅ Found splash key');
    }
    
    print('Diagnostic complete');
  });
}
