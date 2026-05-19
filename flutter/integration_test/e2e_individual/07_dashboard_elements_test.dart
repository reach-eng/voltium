// integration_test/e2e_individual/07_dashboard_elements_test.dart
import 'package:flutter/material.dart';
//
// Standalone test: Verify all dashboard elements are present.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/07_dashboard_elements_test.dart -d emulator-5554

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Dashboard displays all key elements', (tester) async {
    await fullLoginFlow(tester);

    // Verify core dashboard elements
    expect(find.byKey(const Key('dashboardTab')), findsOneWidget);
    expect(find.byKey(const Key('notificationBell')), findsOneWidget);
    expect(find.byKey(const Key('pointsBadge')), findsOneWidget);
    expect(find.byKey(const Key('assignedVehicleCard')), findsOneWidget);
    expect(find.byKey(const Key('copyReferralButton')), findsOneWidget);
  });
}
