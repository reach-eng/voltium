import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_bento_grid.dart';
import '../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for BentoGrid', (WidgetTester tester) async {
    configureGoldenSurface(tester);

    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(BentoGrid()));
    await tester.pump(const Duration(seconds: 1));

    await expectLater(
      find.byType(BentoGrid),
      matchesGoldenFile('goldens/bentogrid_golden.png'),
    );
  });
}
