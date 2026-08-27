import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/user_onboarding_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';

void main() {
  Widget buildTestable(Widget child) {
    return ProviderScope(
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        theme: AppTheme.lightTheme,
        home: child,
      ),
    );
  }

  group('KYC Step Indicator Field Count Chip Tests', () {
    testWidgets('1. Step 1 displays fieldCountChip showing 1/7 initially',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(const UserOnboardingScreen()),
      );
      await tester.pumpAndSettle();

      final chipFinder = find.byKey(const Key('fieldCountChip'));
      expect(chipFinder, findsOneWidget);
      expect(find.text('1/7'), findsOneWidget);
    });

    testWidgets(
        '2. Field count updates live when rider enters full name and father name',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(const UserOnboardingScreen()),
      );
      await tester.pumpAndSettle();

      expect(find.text('1/7'), findsOneWidget);

      await tester.enterText(
          find.byKey(const Key('fullNameField')), 'Rahul Sharma');
      await tester.pumpAndSettle();

      expect(find.text('2/7'), findsOneWidget);

      await tester.enterText(
          find.byKey(const Key('fatherNameField')), 'Suresh Sharma');
      await tester.pumpAndSettle();

      expect(find.text('3/7'), findsOneWidget);
    });

    testWidgets('3. Field count increments when fields are filled',
        (tester) async {
      await tester.pumpWidget(
        buildTestable(const UserOnboardingScreen()),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
          find.byKey(const Key('fullNameField')), 'Rahul Sharma');
      await tester.enterText(
          find.byKey(const Key('fatherNameField')), 'Suresh Sharma');
      await tester.enterText(
          find.byKey(const Key('motherNameField')), 'Sunita Sharma');
      await tester.pumpAndSettle();

      expect(find.text('4/7'), findsOneWidget);
    });
  });
}
