import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/user_onboarding_screen.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/locale_provider.dart';
import 'package:voltium_rider/providers/theme_provider.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// KYC Screen Widget Tests
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

  group('KYC / Onboarding Screen', () {
    testWidgets('onboarding screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const UserOnboardingScreen()));
      await tester.pumpAndSettle();

      expect(find.byType(UserOnboardingScreen), findsOneWidget);
    });

    testWidgets('onboarding screen has a next/continue button or form field', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const UserOnboardingScreen()));
      await tester.pumpAndSettle();

      // At least a text input or button should be visible
      final hasTextField = find.byType(TextField).evaluate().isNotEmpty;
      final hasButton = find.byType(ElevatedButton).evaluate().isNotEmpty;
      final hasTextButton = find.byType(TextButton).evaluate().isNotEmpty;

      expect(hasTextField || hasButton || hasTextButton, isTrue);
    });

    testWidgets('onboarding screen does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const UserOnboardingScreen()));
      await tester.pumpAndSettle();

      // Should render without RenderFlex overflow errors
      expect(tester.takeException(), isNull);
    });
  });
}
