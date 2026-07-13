// integration_test/e2e_individual/30_full_journey_test.dart
//
// Standalone test: Complete user journey from splash to dashboard.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/30_full_journey_test.dart -d emulator-5554 --dart-define=API_URL=http://localhost:8081 --dart-define=TEST_MODE=true

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../pages/app_robots.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Full journey – splash → auth → onboarding → dashboard',
      (tester) async {
    final app = AppRobots(tester);
    final reachedDashboard = await fullLoginFlow(tester);
    expect(
      reachedDashboard,
      isTrue,
      reason: 'Should reach dashboard after full auth',
    );

    // Verify dashboard elements
    expect(app.dashboard.dashboardTab, findsOneWidget);
    expect(app.dashboard.notificationBell, findsOneWidget);
  });
}
