import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/auth/widgets/otp_timer.dart';
import '../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for OTPTimer', (WidgetTester tester) async {
    configureGoldenSurface(tester);

    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(OTPTimer()));
    await tester.pumpAndSettle();

    await expectLater(
      find.byType(OTPTimer),
      matchesGoldenFile('goldens/otptimer_golden.png'),
    );
  });
}
