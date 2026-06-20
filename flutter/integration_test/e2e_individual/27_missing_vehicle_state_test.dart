// integration_test/e2e_individual/27_missing_vehicle_state_test.dart
import 'package:flutter/material.dart';
//
// Standalone test: Dashboard handles missing assigned vehicle gracefully.
// Run: flutter drive --driver=test_driver/integration_test.dart --target=integration_test/e2e_individual/27_missing_vehicle_state_test.dart -d emulator-5554

import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Dashboard – handles missing vehicle state', (tester) async {
    await fullLoginFlow(tester);

    // Dashboard should be visible
    await expectOnDashboard(tester);

    // If no vehicle assigned, should show appropriate messaging
    final noVehicleMessage = find.textContaining('No vehicle');
    final vehicleCard = find.byKey(const Key('assignedVehicleCard'));

    expect(
      noVehicleMessage.evaluate().isNotEmpty ||
          vehicleCard.evaluate().isNotEmpty,
      isTrue,
      reason: 'Should show either vehicle card or no-vehicle message',
    );
  });
}
