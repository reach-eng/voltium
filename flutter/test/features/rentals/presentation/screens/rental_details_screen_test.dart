import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/rental_details_screen.dart';
import '../../../../helpers/golden_test_helper.dart';

void main() {
  testWidgets('Golden test for RentalDetailsScreen',
      (WidgetTester tester) async {
    configureGoldenSurface(tester);

    // Ignore const warning temporarily if constructor is not const
    // ignore: prefer_const_constructors
    await tester.pumpWidget(wrapForGolden(RentalDetailsScreen()));
    await tester.pump(const Duration(seconds: 1));

    await expectLater(
      find.byType(RentalDetailsScreen),
      matchesGoldenFile('goldens/rentaldetailsscreen_golden.png'),
    );
  });

  // DARK-MODE-AUDIT 2026-08-14 PR3: dark-mode golden counterpart.
  testWidgets('Golden test for RentalDetailsScreen (dark mode)',
      (WidgetTester tester) async {
    configureGoldenSurface(tester);

    // ignore: prefer_const_constructors
    await tester.pumpWidget(
        wrapForGolden(RentalDetailsScreen(), themeMode: ThemeMode.dark));
    await tester.pump(const Duration(seconds: 1));

    await expectLater(
      find.byType(RentalDetailsScreen),
      matchesGoldenFile('goldens/rentaldetailsscreen_golden_dark.png'),
    );
  });
}
