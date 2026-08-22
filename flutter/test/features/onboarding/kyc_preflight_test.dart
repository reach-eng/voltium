import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/kyc_preflight_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

/// PR-A (§3.2 / audit #7 P0-3): the pre-flight checklist must be honest about
/// what documents are needed. The misleading "Address Proof" tile was
/// removed — only Aadhaar, PAN, and the time estimate remain.
void main() {
  Widget buildScreen({VoidCallback? onNext, VoidCallback? onSkip}) {
    return MaterialApp(
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('hi')],
      home: KycPreflightScreen(onNext: onNext ?? () {}, onSkip: onSkip),
    );
  }

  testWidgets('shows Aadhaar, PAN and time estimate', (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Aadhaar Card'), findsOneWidget);
    expect(find.text('PAN Card'), findsOneWidget);
    expect(find.text('3 Minutes of Time'), findsOneWidget);
  });

  testWidgets('does not promise an Address Proof upload', (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.textContaining('Address Proof'), findsNothing);
    expect(find.textContaining('Address'), findsNothing);
  });

  testWidgets('I am Ready fires onNext', (tester) async {
    var nextTapped = false;
    await tester.pumpWidget(buildScreen(onNext: () => nextTapped = true));
    await tester.pump(const Duration(milliseconds: 100));

    await tester.tap(find.byKey(const Key('imReadyButton')));
    expect(nextTapped, isTrue);
  });

  testWidgets('skip fires onSkip when provided', (tester) async {
    var skipped = false;
    await tester.pumpWidget(buildScreen(onSkip: () => skipped = true));
    await tester.pump(const Duration(milliseconds: 100));

    await tester.tap(find.byKey(const Key('skipPreflightButton')));
    expect(skipped, isTrue);
  });
}
