import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_flow.dart';

import 'package:voltium_rider/features/wallet/presentation/screens/top_up_amount_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Top-up Flow Widget Tests
void main() {
  Widget buildTestApp({required Widget child}) {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith((ref) => LocaleProvider()),
        themeProviderRef.overrideWith((ref) => ThemeProvider()),
        appProvider.overrideWith((ref) => AppProvider()),
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

  group('Top-up Amount Screen', () {
    testWidgets('amount screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const TopUpAmountScreen()));
      await tester.pumpAndSettle();
      expect(find.byType(TopUpAmountScreen), findsOneWidget);
    });

    testWidgets('amount screen has an amount input field', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const TopUpAmountScreen()));
      await tester.pumpAndSettle();

      // Should have a numeric input for amount
      final hasTextField = find.byType(TextField).evaluate().isNotEmpty;
      expect(hasTextField, isTrue);
    });
  });
}
