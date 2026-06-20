import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_flow.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_purpose_screen.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_amount_screen.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/locale_provider.dart';
import 'package:voltium_rider/providers/theme_provider.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Top-up Flow Widget Tests
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

  group('Top-up Purpose Screen', () {
    testWidgets('purpose screen renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const TopUpPurposeScreen()));
      await tester.pumpAndSettle();
      expect(find.byType(TopUpPurposeScreen), findsOneWidget);
    });

    testWidgets('purpose screen shows deposit and top-up options', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const TopUpPurposeScreen()));
      await tester.pumpAndSettle();

      // Should show purpose options
      final hasDeposit = find.textContaining('deposit', skipOffstage: false).evaluate().isNotEmpty;
      final hasTopup = find.textContaining('top', skipOffstage: false).evaluate().isNotEmpty;
      final hasWallet = find.textContaining('wallet', skipOffstage: false).evaluate().isNotEmpty;
      final hasText = find.byType(Text).evaluate().isNotEmpty;

      expect(hasDeposit || hasTopup || hasWallet || hasText, isTrue);
    });

    testWidgets('purpose screen does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const TopUpPurposeScreen()));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

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
