import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/plan_success_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';

void main() {
  Widget buildTestHost({required VoidCallback onNext}) {
    return MaterialApp(
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: AppTheme.lightTheme,
      home: PlanSuccessScreen(onNext: onNext),
    );
  }

  group('PlanSuccessScreen Tests', () {
    testWidgets('renders confirmation title, description, and check icon',
        (tester) async {
      await tester.pumpWidget(buildTestHost(onNext: () {}));
      await tester.pumpAndSettle();

      expect(find.text('Subscription Confirmed!'), findsOneWidget);
      expect(find.byIcon(Icons.check_rounded), findsOneWidget);
      expect(find.byType(ElevatedButton), findsOneWidget);
    });

    testWidgets('invokes onNext when proceed to pickup button is pressed',
        (tester) async {
      bool nextCalled = false;
      await tester.pumpWidget(buildTestHost(onNext: () => nextCalled = true));
      await tester.pumpAndSettle();

      await tester.tap(find.byType(ElevatedButton));
      await tester.pumpAndSettle();

      expect(nextCalled, isTrue);
    });
  });
}
