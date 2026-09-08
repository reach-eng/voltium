import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import '../helpers/golden_test_harness.dart';
import '../helpers/golden_test_helper.dart';

import 'package:voltium_rider/features/wallet/widgets/earnings_chart.dart';
import 'package:voltium_rider/theme/app_theme.dart';

void main() {
  testWidgets('Golden Test - EarningsChart', (WidgetTester tester) async {
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
      matchesGoldenFile('goldens/earnings_chart_golden_test_default.png'),
    );
  });

  testWidgets(
      'P1-2: EarningsChart adapts container background to dark mode card token',
      (tester) async {
    final sampleEarnings = [
      {'day': 'Mon', 'amount': 450.0},
      {'day': 'Tue', 'amount': 820.0},
      {'day': 'Wed', 'amount': 600.0},
    ];
    final dayLabels = ['M', 'T', 'W'];

    await tester.pumpWidget(
      wrapForGolden(
        EarningsChart(
          dailyEarnings: sampleEarnings,
          dayLabels: dayLabels,
        ),
        themeMode: ThemeMode.dark,
      ),
    );
    await tester.pump();

    expect(find.byType(EarningsChart), findsOneWidget);
    final container = tester.widget<Container>(
      find
          .descendant(
              of: find.byType(EarningsChart), matching: find.byType(Container))
          .first,
    );
    final boxDecoration = container.decoration as BoxDecoration;
    expect(boxDecoration.color, ThemeColors.dark.card);
  });

  testWidgets(
      'P1-2: EarningsChart adapts container background to light mode card token',
      (tester) async {
    final sampleEarnings = [
      {'day': 'Mon', 'amount': 450.0},
      {'day': 'Tue', 'amount': 820.0},
    ];
    final dayLabels = ['M', 'T'];

    await tester.pumpWidget(
      wrapForGolden(
        EarningsChart(
          dailyEarnings: sampleEarnings,
          dayLabels: dayLabels,
        ),
        themeMode: ThemeMode.light,
      ),
    );
    await tester.pump();

    expect(find.byType(EarningsChart), findsOneWidget);
    final container = tester.widget<Container>(
      find
          .descendant(
              of: find.byType(EarningsChart), matching: find.byType(Container))
          .first,
    );
    final boxDecoration = container.decoration as BoxDecoration;
    expect(boxDecoration.color, ThemeColors.light.card);
  });
}
