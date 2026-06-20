import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/profile/presentation/screens/earnings_screen.dart';

Widget buildTestApp() {
  return MaterialApp(home: const EarningsScreen());
}

void main() {
  group('Earnings Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump();
      expect(find.byType(EarningsScreen), findsOneWidget);
    });

    testWidgets('shows loading indicator initially', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump();
      // Screen starts in loading state before API call completes
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });
  });
}
