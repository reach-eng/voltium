import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/wallet/widgets/skeleton_wallet_card.dart';
import '../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for SkeletonWalletCard', (WidgetTester tester) async {
    configureGoldenSurface(tester);
    
    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(SkeletonWalletCard()));
    await tester.pumpAndSettle();
    
    await expectLater(
      find.byType(SkeletonWalletCard),
      matchesGoldenFile('goldens/skeletonwalletcard_golden.png'),
    );
  });
}
