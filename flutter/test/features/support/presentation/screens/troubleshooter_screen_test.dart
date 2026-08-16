import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/support/presentation/screens/troubleshooter_screen.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for TroubleshooterScreen',
      (WidgetTester tester) async {
    configureGoldenSurface(tester);

    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(TroubleshooterScreen()));
    await tester.pump(const Duration(seconds: 1));

    await expectLater(
      find.byType(TroubleshooterScreen),
      matchesGoldenFile('goldens/troubleshooterscreen_golden.png'),
    );
  });

  // DARK-MODE-AUDIT 2026-08-14 PR3: dark-mode golden counterpart.
  testWidgets('Golden test for TroubleshooterScreen (dark mode)',
      (WidgetTester tester) async {
    configureGoldenSurface(tester);

    // ignore: prefer_const_constructors
    await tester.pumpWidget(
        wrapForGolden(TroubleshooterScreen(), themeMode: ThemeMode.dark));
    await tester.pump(const Duration(seconds: 1));

    await expectLater(
      find.byType(TroubleshooterScreen),
      matchesGoldenFile('goldens/troubleshooterscreen_golden_dark.png'),
    );
  });
}
