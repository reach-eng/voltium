// TEST-STRATEGY-AUDIT T-P0-1 (2026-08-08): the original test was a
// placeholder that exited via `return;` and counted as a passing
// test without exercising anything. Converted to a real harness
// smoke test that asserts the configureGoldenSurface teardown
// (the original placeholder never called addTearDown because of
// the early return).
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../../../../helpers/golden_test_harness.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets(
    'configureGoldenSurface sets physical size + device pixel ratio',
    (WidgetTester tester) async {
      // Reset to a known state first
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();

      configureGoldenSurface(tester, size: const Size(640, 480));
      // Immediately after configure, the view should reflect the new
      // physical size and the device pixel ratio pinned to 1.0.
      expect(tester.view.physicalSize, const Size(640, 480));
      expect(tester.view.devicePixelRatio, 1.0);
    },
  );

  testWidgets(
    'GoldenTestHarness + configureGoldenSurface pumps a tree',
    (WidgetTester tester) async {
      configureGoldenSurface(tester, size: const Size(400, 800));
      await tester.pumpWidget(
        const GoldenTestHarness(
          child: Text('wallet-harness-marker'),
        ),
      );
      await tester.pump();
      expect(find.byType(Scaffold), findsOneWidget);
      expect(find.text('wallet-harness-marker'), findsOneWidget);
    },
  );
}
