import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_proof_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

Widget buildTestApp({ThemeMode themeMode = ThemeMode.light}) {
  return ProviderScope(
    child: MaterialApp(
      themeMode: themeMode,
      theme: ThemeData.light(),
      darkTheme: ThemeData.dark(),
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('hi')],
      home: const TopUpProofScreen(amount: 500),
    ),
  );
}

void main() {
  group('Top Up Proof Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(TopUpProofScreen), findsOneWidget);
    });

    testWidgets('displays step info', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      expect(find.textContaining('Step 2 of 2'), findsOneWidget);
    });

    testWidgets('shows upload proof title', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      expect(find.text('Upload Proof'), findsOneWidget);
    });

    testWidgets('does not overflow', (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));
      expect(tester.takeException(), isNull);
    });

    testWidgets(
        'displays Instant Payment option and opens alert dialog when tapped',
        (tester) async {
      await tester.pumpWidget(buildTestApp());
      await tester.pump(const Duration(seconds: 1));

      final instantOption = find.byKey(const Key('instantPaymentOption'));
      expect(instantOption, findsOneWidget);

      await tester.tap(instantOption);
      await tester.pumpAndSettle();

      expect(find.text('Instant Payment'), findsAtLeastNWidgets(1));
      expect(find.textContaining('2.5%'), findsAtLeastNWidgets(1));

      final proceedBtn = find.text('PROCEED TO PAYMENT');
      expect(proceedBtn, findsOneWidget);
      await tester.tap(proceedBtn);
      await tester.pumpAndSettle();

      expect(find.text('Instant Payment Breakdown'), findsOneWidget);
      expect(find.textContaining('Proceed to Instant Pay'), findsOneWidget);
    });

    testWidgets('switches to UPI mode and displays UPI copy and UTR field',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      final upiOption = find.text('UPI');
      expect(upiOption, findsOneWidget);
      await tester.tap(upiOption);
      await tester.pumpAndSettle();

      expect(find.text('VOLTIUM UPI ID'), findsOneWidget);
      expect(find.text('payments.voltium@icici'), findsOneWidget);
      expect(find.byKey(const Key('copyUpiIdButton')), findsOneWidget);
      expect(find.byKey(const Key('upiRefField')), findsOneWidget);

      // Enter UTR text
      await tester.enterText(
          find.byKey(const Key('upiRefField')), '123456789012');
      await tester.pumpAndSettle();
    });

    testWidgets('renders cleanly in dark mode without throwing',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(themeMode: ThemeMode.dark));
      await tester.pumpAndSettle();

      expect(find.byType(TopUpProofScreen), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  });
}
