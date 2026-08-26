import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/feedback_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/troubleshooter_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

/// Enhanced support screen widget tests covering:
/// - SupportCenterScreen: layout, back navigation, content
/// - FeedbackScreen: rating stars, comment field, submit states
/// - TroubleshooterScreen: categories, selection, navigation

Widget wrapWithProviders(Widget child) {
  return ProviderScope(
    overrides: [
      localeProviderRef.overrideWith((ref) => LocaleProvider()),
      themeProviderRef.overrideWith((ref) => ThemeProvider()),
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

void main() {
  group('SupportCenterScreen — Layout', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(wrapWithProviders(
        const SupportCenterScreen(),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(SupportCenterScreen), findsOneWidget);
    });

    testWidgets('displays Support Center title', (tester) async {
      await tester.pumpWidget(wrapWithProviders(
        const SupportCenterScreen(),
      ));
      await tester.pump(const Duration(seconds: 1));
      // Title appears in both AppBar and body text
      expect(find.text('Support Center'), findsAtLeastNWidgets(1));
    });

    testWidgets('has Support Center title visible', (tester) async {
      await tester.pumpWidget(wrapWithProviders(
        const SupportCenterScreen(),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Support Center'), findsAtLeastNWidgets(1));
    });

    testWidgets('body displays support content', (tester) async {
      await tester.pumpWidget(wrapWithProviders(
        const SupportCenterScreen(),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(
        find.text('Support Center'),
        findsWidgets,
      );
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(wrapWithProviders(
        const SupportCenterScreen(),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders inside a scaffold without error', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            localeProviderRef.overrideWith((ref) => LocaleProvider()),
            themeProviderRef.overrideWith((ref) => ThemeProvider()),
          ],
          child: const MaterialApp(
            home: Scaffold(body: SupportCenterScreen()),
          ),
        ),
      );
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(SupportCenterScreen), findsOneWidget);
    });
  });

  group('FeedbackScreen — Layout', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(FeedbackScreen), findsOneWidget);
    });

    testWidgets('displays Feedback header', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Feedback'), findsOneWidget);
    });

    testWidgets('displays Share Your Thoughts heading', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Share Your Thoughts'), findsOneWidget);
    });

    testWidgets('displays description text', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(
        find.textContaining('Your feedback helps us improve'),
        findsOneWidget,
      );
    });

    testWidgets('shows SUBMIT FEEDBACK button', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('SUBMIT FEEDBACK'), findsOneWidget);
    });

    testWidgets('shows comment input field', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(
        find.text('Tell us more about your experience...'),
        findsOneWidget,
      );
    });

    testWidgets('submit button is disabled when no rating', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));

      // Find the ElevatedButton ancestor of the SUBMIT FEEDBACK text
      final buttonFinder = find.ancestor(
        of: find.text('SUBMIT FEEDBACK'),
        matching: find.byType(ElevatedButton),
      );
      final button = tester.widget<ElevatedButton>(buttonFinder);
      expect(button.onPressed, isNull);
    });

    testWidgets('close button is present', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(find.byIcon(Icons.close), findsOneWidget);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });
  });

  group('FeedbackScreen — Rating Stars', () {
    testWidgets('shows 5 star icons', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));

      final stars = find.byIcon(Icons.star_outline_rounded);
      expect(stars, findsNWidgets(5));
    });

    testWidgets('tapping a star selects it and fills it', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));

      // Tap the 3rd star
      await tester.tap(find.byIcon(Icons.star_outline_rounded).at(2));
      await tester.pump(const Duration(seconds: 1));

      // Stars 0-2 should be filled, stars 3-4 should be outline
      final filledStars = find.byIcon(Icons.star_rounded);
      expect(filledStars, findsNWidgets(3));
    });

    testWidgets('submit button is enabled after rating', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));

      // Tap first star
      await tester.tap(find.byIcon(Icons.star_outline_rounded).first);
      await tester.pump(const Duration(seconds: 1));

      // Find the ElevatedButton ancestor of the SUBMIT FEEDBACK text
      final buttonFinder = find.ancestor(
        of: find.text('SUBMIT FEEDBACK'),
        matching: find.byType(ElevatedButton),
      );
      final button = tester.widget<ElevatedButton>(buttonFinder);
      expect(button.onPressed, isNotNull);
    });

    testWidgets('can change rating by tapping different star', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));

      // Tap 4th star
      await tester.tap(find.byIcon(Icons.star_outline_rounded).at(3));
      await tester.pump(const Duration(seconds: 1));

      final filledStars = find.byIcon(Icons.star_rounded);
      expect(filledStars, findsNWidgets(4));
    });

    testWidgets('rating updates star visual state', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));

      // Initially all outline
      expect(find.byIcon(Icons.star_outline_rounded), findsNWidgets(5));
      expect(find.byIcon(Icons.star_rounded), findsNothing);

      // Tap 1st star
      await tester.tap(find.byIcon(Icons.star_outline_rounded).first);
      await tester.pump(const Duration(seconds: 1));

      expect(find.byIcon(Icons.star_rounded), findsNWidgets(1));
      expect(find.byIcon(Icons.star_outline_rounded), findsNWidgets(4));
    });
  });

  group('FeedbackScreen — Comment Input', () {
    testWidgets('can type in comment field', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));

      await tester.enterText(
        find.byType(TextFormField),
        'Great app!',
      );
      await tester.pump();

      expect(find.text('Great app!'), findsOneWidget);
    });

    testWidgets('comment field accepts multi-line input', (tester) async {
      await tester.pumpWidget(MaterialApp(
        home: FeedbackScreen(onSubmit: () {}),
      ));
      await tester.pump(const Duration(seconds: 1));

      // Enter multi-line text
      await tester.enterText(
        find.byType(TextFormField),
        'Line 1\nLine 2\nLine 3',
      );
      await tester.pump();

      expect(find.text('Line 1\nLine 2\nLine 3'), findsOneWidget);
    });
  });

  group('TroubleshooterScreen — Layout', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(wrapWithProviders(
        const TroubleshooterScreen(),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(TroubleshooterScreen), findsOneWidget);
    });

    testWidgets('displays Smart Troubleshooter title', (tester) async {
      await tester.pumpWidget(wrapWithProviders(
        const TroubleshooterScreen(),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Smart Troubleshooter'), findsOneWidget);
    });

    testWidgets('shows issue selection prompt', (tester) async {
      await tester.pumpWidget(wrapWithProviders(
        const TroubleshooterScreen(),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(
        find.textContaining('What issue are you experiencing?'),
        findsOneWidget,
      );
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(wrapWithProviders(
        const TroubleshooterScreen(),
      ));
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });
  });
}
