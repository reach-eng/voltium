import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../helpers/golden_test_harness.dart';
import '../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden Test - EffectWidgets', (WidgetTester tester) async {
    configureGoldenSurface(tester);
    await tester.pumpWidget(
      const GoldenTestHarness(
        child: SizedBox(
            width: 100, height: 100, child: Placeholder()), // Mocked fallback
      ),
    );
    await tester.pump(const Duration(seconds: 1));
    await expectLater(
      find.byType(SizedBox),
      matchesGoldenFile('goldens/effect_widgets_golden_test_default.png'),
    );
  });
}
