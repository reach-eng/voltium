/// PR-A — Regression test for the KYC pre-flight screen.
///
/// Verifies the screen renders, shows all 3 checklist items, and the
/// "I'm Ready" button triggers the `onNext` callback.
///
/// Audit #7 P0-3 (2026-08-06): the misleading "Address Proof" tile was
/// removed — only Aadhaar, PAN, and the time estimate are promised.
library;

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/kyc_preflight_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

void main() {
  Widget app({required Widget home}) {
    return MaterialApp(
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('hi')],
      home: home,
    );
  }

  testWidgets('KycPreflightScreen renders 3 checklist items', (tester) async {
    await tester.pumpWidget(
      app(home: KycPreflightScreen(onNext: _noop, onSkip: _noop)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Aadhaar Card'), findsOneWidget);
    expect(find.text('PAN Card'), findsOneWidget);
    expect(find.text('3 Minutes of Time'), findsOneWidget);
    // The removed tile must not resurface (audit #7 P0-3).
    expect(find.text('Address Proof'), findsNothing);
  });

  testWidgets("'I'm Ready' button triggers onNext callback", (tester) async {
    var nextCount = 0;
    await tester.pumpWidget(
      app(home: KycPreflightScreen(onNext: () => nextCount++)),
    );
    await tester.pumpAndSettle();

    final readyButton = find.byKey(const Key('imReadyButton'));
    expect(readyButton, findsOneWidget);
    await tester.tap(readyButton);
    await tester.pumpAndSettle();
    expect(nextCount, 1, reason: "onNext should fire exactly once on tap");
  });

  testWidgets("'I'll do this later' button triggers onSkip callback",
      (tester) async {
    var skipCount = 0;
    await tester.pumpWidget(
      app(
        home: KycPreflightScreen(
          onNext: _noop,
          onSkip: () => skipCount++,
        ),
      ),
    );
    await tester.pumpAndSettle();

    final skipButton = find.byKey(const Key('skipPreflightButton'));
    expect(skipButton, findsOneWidget);
    await tester.tap(skipButton);
    await tester.pumpAndSettle();
    expect(skipCount, 1);
  });

  testWidgets('Skip button is hidden when onSkip is null', (tester) async {
    await tester.pumpWidget(
      app(home: KycPreflightScreen(onNext: _noop)),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('skipPreflightButton')), findsNothing);
  });
}

void _noop() {}
