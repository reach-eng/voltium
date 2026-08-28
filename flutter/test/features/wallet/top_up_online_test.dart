import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_proof_screen.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

/// PR-C (2026-08-28): the test docstring was previously out of sync
/// with the production — it said the "Instant Online Top-Up" option
/// was removed, but the production kept it (top_up_proof_screen.dart
/// still has `Key('instantPaymentOption')`). The audit and the
/// original test author agreed: keep the option in production so
/// the rider sees three choices (Cash / UPI / Instant), but assert
/// that tapping Instant does NOT open a Razorpay URL (no signed
/// order_id; the backend has no order-init/webhook). Admin manually
/// verifies all three paths.
void main() {
  Widget buildScreen() {
    return ProviderScope(
      child: const MaterialApp(
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: const [Locale('en'), Locale('hi')],
        home: TopUpProofScreen(amount: 2000),
      ),
    );
  }

  testWidgets('offers Cash, UPI, and Instant payment methods', (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('SELECT PAYMENT METHOD'), findsOneWidget);
    expect(find.text('Cash'), findsOneWidget);
    expect(find.text('UPI'), findsOneWidget);
    expect(find.text('Instant'), findsOneWidget);
  });

  testWidgets('has instant payment option pointing to active gateway',
      (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 300));

    expect(find.text('Instant'), findsOneWidget);
    expect(find.textContaining('Razorpay'), findsNothing);
    expect(find.textContaining('Card'), findsNothing);
  });

  testWidgets('explains manual verification honestly', (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 300));

    expect(
      find.textContaining('Payments are verified manually', findRichText: true),
      findsOneWidget,
    );
  });
}
