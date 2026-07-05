import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/device_compliance/presentation/screens/emergency_sos_screen.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for EmergencySOSScreen',
      (WidgetTester tester) async {
    configureGoldenSurface(tester);

    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(EmergencySOSScreen()));
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(EmergencySOSScreen),
      matchesGoldenFile('goldens/emergencysosscreen_golden.png'),
    );
  });
}
