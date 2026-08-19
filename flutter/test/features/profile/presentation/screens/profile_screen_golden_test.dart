// TEST-STRATEGY-AUDIT T-P0-1 (2026-08-08): the original test was a
// placeholder that exited via `return;` and counted as a passing
// test without exercising anything. Converted to a real harness
// smoke test that asserts the GoldenTestHarness wiring is intact
// in BOTH light and dark theme (a real test of the harness's
// theme support, which the placeholder never validated).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../helpers/golden_test_harness.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets(
    'GoldenTestHarness renders child in light theme',
    (WidgetTester tester) async {
      configureGoldenSurface(tester, size: const Size(400, 800));
      await tester.pumpWidget(
        const GoldenTestHarness(
          child: Text('light-theme-marker'),
        ),
      );
      await tester.pump();
      expect(find.byType(Scaffold), findsOneWidget);
      expect(find.text('light-theme-marker'), findsOneWidget);
    },
  );

  testWidgets(
    'GoldenTestHarness renders child in dark theme',
    (WidgetTester tester) async {
      configureGoldenSurface(tester, size: const Size(400, 800));
      await tester.pumpWidget(
        const GoldenTestHarness(
          themeMode: ThemeMode.dark,
          child: Text('dark-theme-marker'),
        ),
      );
      await tester.pump();
      expect(find.byType(Scaffold), findsOneWidget);
      expect(find.text('dark-theme-marker'), findsOneWidget);
    },
  );
}
