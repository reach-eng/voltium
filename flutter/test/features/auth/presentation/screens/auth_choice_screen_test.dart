import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/auth/presentation/screens/auth_choice_screen.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for AuthChoiceScreen', (WidgetTester tester) async {
    configureGoldenSurface(tester);
    
    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(AuthChoiceScreen()));
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(AuthChoiceScreen),
      matchesGoldenFile('goldens/authchoicescreen_golden.png'),
    );
  });
}
