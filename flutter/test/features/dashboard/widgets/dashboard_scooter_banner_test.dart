import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_scooter_banner.dart';
import '../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for ScooterSubmissionBanner', (WidgetTester tester) async {
    configureGoldenSurface(tester);
    
    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(ScooterSubmissionBanner()));
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(ScooterSubmissionBanner),
      matchesGoldenFile('goldens/scootersubmissionbanner_golden.png'),
    );
  });
}
