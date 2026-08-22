import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/kyc_preflight_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

void main() {
  testWidgets('KycPreflightScreen renders checklist items and handles action',
      (WidgetTester tester) async {
    bool nextTapped = false;
    bool skipTapped = false;

    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en'), Locale('hi')],
        home: KycPreflightScreen(
          onNext: () => nextTapped = true,
          onSkip: () => skipTapped = true,
        ),
      ),
    );

    // Verify header and items. "Address Proof" was removed (audit #4 P0-3 —
    // the KYC document flow has no address-document slot, so promising one
    // was a lie). The checklist is now exactly Aadhaar / PAN / 3 Minutes.
    expect(find.text('Before You Begin'), findsOneWidget);
    expect(find.text('Aadhaar Card'), findsOneWidget);
    expect(find.text('PAN Card'), findsOneWidget);
    expect(find.text('3 Minutes of Time'), findsOneWidget);
    expect(find.text('Address Proof'), findsNothing);

    // Verify tap on "I'm Ready"
    await tester.tap(find.byKey(const Key('imReadyButton')));
    await tester.pumpAndSettle();
    expect(nextTapped, isTrue);

    // Verify tap on skip
    await tester.tap(find.byKey(const Key('skipPreflightButton')));
    await tester.pumpAndSettle();
    expect(skipTapped, isTrue);
  });
}
