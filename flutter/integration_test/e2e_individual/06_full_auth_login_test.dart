// integration_test/e2e_individual/06_full_auth_login_test.dart
import 'package:flutter/material.dart';
//
// Standalone test: Complete auth flow from splash to dashboard.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/06_full_auth_login_test.dart -d emulator-5554

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Full auth journey – splash to dashboard', (tester) async {
    final reachedDashboard = await fullLoginFlow(tester);
    expect(reachedDashboard, isTrue,
        reason: 'Should reach dashboard after full auth');
  });
}
