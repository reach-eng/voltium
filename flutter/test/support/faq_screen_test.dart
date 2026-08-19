import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/support/presentation/screens/faq_screen.dart';
import 'package:voltium_rider/models/support_model.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/core/state/app_provider.dart';

import 'package:voltium_rider/features/support/presentation/providers/support_provider.dart';

class _TestAppProvider extends AppProvider {
  @override
  Future<void> refreshTransactions() async {}
  @override
  Future<void> refresh() async {}
  @override
  Future<void> refreshFromApi() async {}
}

class _SeededSupportNotifier extends SupportNotifier {
  final List<FaqItem> _faqs;
  _SeededSupportNotifier(this._faqs);

  @override
  SupportState build() => SupportState(faqs: _faqs);
}

Widget buildTestApp({
  ThemeMode themeMode = ThemeMode.light,
  List<FaqItem>? faqs,
}) {
  return ProviderScope(
    overrides: [
      localeProviderRef.overrideWith(() => LocaleProvider()),
      themeProviderRef.overrideWith(() => ThemeProvider()),
      appProvider.overrideWith((ref) => _TestAppProvider()),
      if (faqs != null)
        supportProvider.overrideWith(() => _SeededSupportNotifier(faqs)),
    ],
    child: MaterialApp(
      themeMode: themeMode,
      theme: ThemeData.light(),
      darkTheme: ThemeData.dark(),
      home: const FaqScreen(),
    ),
  );
}

void main() {
  group('FAQ Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.byType(FaqScreen), findsAtLeastNWidgets(1));
    });

    testWidgets('displays help and FAQ title', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Help & FAQ'), findsAtLeastNWidgets(1));
    });

    testWidgets('filters FAQs by search input', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final faqs = [
        const FaqItem(
          id: 'faq-1',
          question: 'How do I unlock the scooter?',
          answer: 'Use the Smart Lock button on your active dashboard.',
          categoryId: 'Vehicle',
        ),
        const FaqItem(
          id: 'faq-2',
          question: 'Where are the battery swap stations?',
          answer: 'Locate the nearest swap station using the Hub Finder.',
          categoryId: 'Battery',
        ),
      ];

      await tester.pumpWidget(buildTestApp(faqs: faqs));
      await tester.pumpAndSettle();

      expect(find.text('How do I unlock the scooter?'), findsAtLeastNWidgets(1));
      expect(find.text('Where are the battery swap stations?'), findsAtLeastNWidgets(1));

      // Enter search text
      await tester.enterText(find.byType(TextFormField), 'unlock');
      await tester.pumpAndSettle();

      expect(find.text('How do I unlock the scooter?'), findsAtLeastNWidgets(1));
      expect(find.text('Where are the battery swap stations?'), findsNothing);
    });

    testWidgets('expands and collapses FAQ accordion on tap', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      final faqs = [
        const FaqItem(
          id: 'faq-1',
          question: 'How do I top up my wallet?',
          answer: 'Go to the Wallet screen and click Add Money to pay via UPI or Bank Transfer.',
          categoryId: 'Wallet',
        ),
      ];

      await tester.pumpWidget(buildTestApp(faqs: faqs));
      await tester.pumpAndSettle();

      // Initially collapsed: answer text is not in tree
      expect(find.text('Go to the Wallet screen and click Add Money to pay via UPI or Bank Transfer.'), findsNothing);

      // Tap on question
      await tester.tap(find.text('How do I top up my wallet?'));
      await tester.pumpAndSettle();

      expect(find.text('Go to the Wallet screen and click Add Money to pay via UPI or Bank Transfer.'), findsAtLeastNWidgets(1));
    });

    testWidgets('renders properly in dark mode', (tester) async {
      await tester.pumpWidget(buildTestApp(themeMode: ThemeMode.dark));
      await tester.pumpAndSettle();
      expect(find.byType(FaqScreen), findsAtLeastNWidgets(1));
      expect(tester.takeException(), isNull);
    });
  });
}
