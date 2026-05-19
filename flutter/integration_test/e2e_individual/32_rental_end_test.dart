// integration_test/e2e_individual/32_rental_end_test.dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import '../helpers/test_helpers.dart';

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Rental – dashboard accessible', (tester) async {
    await fullLoginFlow(tester);
    await expectOnDashboard(tester);
  });
}
