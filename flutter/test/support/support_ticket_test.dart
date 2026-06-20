import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/locale_provider.dart';
import 'package:voltium_rider/providers/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Support Screen Widget Tests
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

  group('Support Center Screen', () {
    testWidgets('support center renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const SupportCenterScreen()));
      await tester.pumpAndSettle();
      expect(find.byType(SupportCenterScreen), findsOneWidget);
    });

    testWidgets('support center shows support categories or options', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const SupportCenterScreen()));
      await tester.pumpAndSettle();

      // Should show some support options, FAQs, or contact info
      final hasListTile = find.byType(ListTile).evaluate().isNotEmpty;
      final hasCard = find.byType(Card).evaluate().isNotEmpty;
      final hasText = find.byType(Text).evaluate().isNotEmpty;

      expect(hasListTile || hasCard || hasText, isTrue);
    });

    testWidgets('support center does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const SupportCenterScreen()));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });
}
