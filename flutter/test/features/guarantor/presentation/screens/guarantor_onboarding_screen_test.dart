import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for GuarantorOnboardingScreen', (WidgetTester tester) async {
    configureGoldenSurface(tester);
    
    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(GuarantorOnboardingScreen()));
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(GuarantorOnboardingScreen),
      matchesGoldenFile('goldens/guarantoronboardingscreen_golden.png'),
    );
  });
}
