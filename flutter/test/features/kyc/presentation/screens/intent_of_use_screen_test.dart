import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/intent_of_use_screen.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for IntentOfUseScreen', (WidgetTester tester) async {
    configureGoldenSurface(tester);
    
    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(IntentOfUseScreen()));
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(IntentOfUseScreen),
      matchesGoldenFile('goldens/intentofusescreen_golden.png'),
    );
  });
}
