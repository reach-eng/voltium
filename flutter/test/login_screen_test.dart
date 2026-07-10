import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/auth/presentation/screens/login_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

void main() {
  testWidgets('LoginScreen displays phone input and button',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(overrides: [
          localeProviderRef.overrideWith((ref) => LocaleProvider()),
          themeProviderRef.overrideWith((ref) => ThemeProvider()),
        ], child: const MaterialApp(
          localizationsDelegates: [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          home: LoginScreen(),
        ),
      ),
    );

    await tester.pumpAndSettle();

    // Verify phone input field exists
    expect(find.byKey(const Key('phoneInput')), findsOneWidget);

    // Verify title
    expect(find.text('Welcome'), findsOneWidget);

    // Verify "Enter" button
    expect(find.byKey(const Key('sendOtpButton')), findsOneWidget);
    expect(find.text('Enter'), findsOneWidget);
  });
}
