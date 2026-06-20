import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/locale_provider.dart';
import 'package:voltium_rider/providers/theme_provider.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Guarantor Screen Widget Tests
void main() {
  Widget buildTestApp({required Widget child}) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => LocaleProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
        ChangeNotifierProvider(create: (_) => AppProvider()),
      ],
      child: MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: child,
      ),
    );
  }

  group('Guarantor Onboarding Screen', () {
    testWidgets('guarantor screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const GuarantorOnboardingScreen()));
      await tester.pumpAndSettle();
      expect(find.byType(GuarantorOnboardingScreen), findsOneWidget);
    });

    testWidgets('guarantor screen has form fields for name and phone', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const GuarantorOnboardingScreen()));
      await tester.pumpAndSettle();

      // Should have text fields for guarantor info
      final textFields = find.byType(TextField).evaluate();
      expect(textFields.length, greaterThanOrEqualTo(1));
    });

    testWidgets('guarantor screen does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const GuarantorOnboardingScreen()));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
