import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/referrals/presentation/screens/referral_screen.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for ReferralScreen', (WidgetTester tester) async {
    configureGoldenSurface(tester);

    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(ReferralScreen()));
    await tester.pump(const Duration(seconds: 1));

    await expectLater(
      find.byType(ReferralScreen),
      matchesGoldenFile('goldens/referralscreen_golden.png'),
    );
  });
}
