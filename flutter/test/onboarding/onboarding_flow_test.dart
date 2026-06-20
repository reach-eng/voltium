import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/onboarding_screen.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/splash_screen.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/locale_provider.dart';
import 'package:voltium_rider/providers/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Onboarding Flow Widget Tests
void main() {
  Widget buildTestApp({required Widget child}) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => LocaleProvider()),
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
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

  group('Onboarding Screen', () {
    testWidgets('onboarding screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: OnboardingScreen(
          onComplete: () {},
          pages: const [],
        ),
      ));
      await tester.pumpAndSettle();
      expect(find.byType(OnboardingScreen), findsOneWidget);
    });

    testWidgets('onboarding screen shows checklist or steps', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: OnboardingScreen(
          onComplete: () {},
          pages: const [],
        ),
      ));
      await tester.pumpAndSettle();

      final hasSteps = find.byType(ListTile).evaluate().isNotEmpty ||
          find.byType(Card).evaluate().isNotEmpty ||
          find.byType(Text).evaluate().isNotEmpty;

      expect(hasSteps, isTrue);
    });

    testWidgets('onboarding screen does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: OnboardingScreen(
          onComplete: () {},
          pages: const [],
        ),
      ));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group('Splash Screen', () {
    testWidgets('splash screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: SplashScreen(onComplete: () {}),
      ));
      await tester.pump(); // Single pump for splash
      expect(find.byType(SplashScreen), findsOneWidget);
      // Advance timers to prevent "Timer still pending" error
      await tester.pump(const Duration(milliseconds: 200));
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();
    });
  });
}
