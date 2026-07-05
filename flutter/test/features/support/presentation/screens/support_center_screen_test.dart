import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for SupportCenterScreen',
      (WidgetTester tester) async {
    configureGoldenSurface(tester);

    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(SupportCenterScreen()));
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(SupportCenterScreen),
      matchesGoldenFile('goldens/supportcenterscreen_golden.png'),
    );
  });
}
