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
    await tester.pump(const Duration(seconds: 1));

    await expectLater(
      find.byType(EmergencySOSScreen),
      matchesGoldenFile('goldens/emergencysosscreen_golden.png'),
    );
  });

  // DARK-MODE-AUDIT 2026-08-14 PR3: dark-mode golden counterpart.
  testWidgets('Golden test for EmergencySOSScreen (dark mode)',
      (WidgetTester tester) async {
    configureGoldenSurface(tester);

    // ignore: prefer_const_constructors
    await tester.pumpWidget(
        wrapForGolden(EmergencySOSScreen(), themeMode: ThemeMode.dark));
    await tester.pump(const Duration(seconds: 1));

    await expectLater(
      find.byType(EmergencySOSScreen),
      matchesGoldenFile('goldens/emergencysosscreen_golden_dark.png'),
    );
  });
}
