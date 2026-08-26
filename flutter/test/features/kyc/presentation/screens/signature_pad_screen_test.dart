import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/signature_pad_screen.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for SignaturePadScreen',
      (WidgetTester tester) async {
    configureGoldenSurface(tester);

    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(SignaturePadScreen()));
    await tester.pump(const Duration(seconds: 1));

    await expectLater(
      find.byType(SignaturePadScreen),
      matchesGoldenFile('goldens/signaturepadscreen_golden.png'),
    );
  });
}
