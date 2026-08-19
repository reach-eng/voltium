// TEST-STRATEGY-AUDIT T-P0-1 (2026-08-08): the original test was a
// placeholder that exited via `return;` and counted as a passing
// test without exercising anything. Converted to a real harness
// smoke test that asserts the GoldenTestHarness wiring is intact.
// The full golden-image comparison (PNG fixture match) is still
// pending — generate via `flutter test --update-goldens` once
// committed reference PNGs exist.
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import '../../../../helpers/golden_test_harness.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets(
    'GoldenTestHarness wires MaterialApp + ProviderScope + Scaffold',
    (WidgetTester tester) async {
      configureGoldenSurface(tester, size: const Size(400, 800));

      await tester.pumpWidget(
        const GoldenTestHarness(
          child: SizedBox(
            width: double.infinity,
            height: double.infinity,
            child: Center(child: Text('harness-ok')),
          ),
        ),
      );
      await tester.pump();

      // Real assertions — failure here means the test harness is
      // broken, not the dashboard screen. The previous placeholder
      // passed even when the harness was entirely missing.
      expect(find.byType(MaterialApp), findsOneWidget);
      expect(find.byType(ProviderScope), findsOneWidget);
      expect(find.byType(Scaffold), findsOneWidget);
      expect(find.text('harness-ok'), findsOneWidget);
    },
  );
}
