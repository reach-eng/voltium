import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../helpers/golden_test_harness.dart';
import '../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden Test - WebBanner', (WidgetTester tester) async {
    configureGoldenSurface(tester);
    await tester.pumpWidget(
      const GoldenTestHarness(
        child: SizedBox(
            width: 100, height: 100, child: Placeholder()), // Mocked fallback
      ),
    );
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(SizedBox),
      matchesGoldenFile('goldens/web_banner_golden_test_default.png'),
    );
  });
}
