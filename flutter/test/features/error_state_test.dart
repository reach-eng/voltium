// PR #3 (UX-1) — Behavioral tests for the canonical ErrorState widget.
//
// Asserts that the factories (.network, .otp, .document, .topup, .form,
// .empty, .generic) all produce the right title, message, and CTA copy
// and that the retry button is wired correctly when an onRetry is passed.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/widgets/error_state.dart';

void main() {
  group('PR #3 — ErrorState factories', () {
    testWidgets('.network renders offline title + retry', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ErrorState.network(
              onRetry: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text("You're offline"), findsOneWidget);
      expect(
        find.textContaining("Check your internet connection"),
        findsOneWidget,
      );
      expect(find.byIcon(Icons.cloud_off_rounded), findsOneWidget);
      expect(find.text('Retry'), findsOneWidget);

      await tester.tap(find.text('Retry'));
      await tester.pump();
      expect(tapped, isTrue);
    });

    testWidgets('.otp renders wrong-code title + attempt counter',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ErrorState.otp(attemptsRemaining: 2, onRetry: () {}),
          ),
        ),
      );

      expect(find.text('Wrong code'), findsOneWidget);
      expect(
        find.textContaining('2 attempts left'),
        findsOneWidget,
      );
      // Singular "attempt" when 1 remains.
      expect(find.text('Try again'), findsOneWidget);
    });

    testWidgets('.document renders photo-not-clear title + retake CTA',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ErrorState.document(onRetry: () {}),
          ),
        ),
      );

      expect(find.text('Photo not clear'), findsOneWidget);
      expect(find.text('Retake photo'), findsOneWidget);
      expect(find.byIcon(Icons.no_photography_outlined), findsOneWidget);
    });

    testWidgets('.topup renders payment-pending + check-status CTA',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ErrorState.topup(onRetry: () {}),
          ),
        ),
      );

      expect(find.text('Payment not received yet'), findsOneWidget);
      expect(find.text('Check status'), findsOneWidget);
      expect(
        find.textContaining('auto-refresh in 30 seconds'),
        findsOneWidget,
      );
    });

    testWidgets('.form uses passed title + Got it CTA', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ErrorState.form(
              title: 'Phone number is invalid',
              message: 'Please enter a 10-digit Indian mobile number.',
              onRetry: () {},
            ),
          ),
        ),
      );

      expect(find.text('Phone number is invalid'), findsOneWidget);
      expect(find.text('Got it'), findsOneWidget);
    });

    testWidgets('.empty defaults to No results found', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ErrorState.empty(onRetry: () {}),
          ),
        ),
      );

      expect(find.text('No results found'), findsOneWidget);
      expect(find.text('Refresh'), findsOneWidget);
    });

    testWidgets('.generic hides leak-prone exception by default',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ErrorState.generic(),
          ),
        ),
      );

      expect(find.text('Something went wrong'), findsOneWidget);
      // The factory default message must NOT include any raw exception text.
      expect(
        find.textContaining('Exception'),
        findsNothing,
      );
      expect(
        find.textContaining('Error: '),
        findsNothing,
      );
    });

    testWidgets('no CTA is rendered when onRetry is null', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: ErrorState.generic(
              message: 'A specific error message.',
            ),
          ),
        ),
      );

      expect(find.byType(FilledButton), findsNothing);
      expect(find.byType(ElevatedButton), findsNothing);
    });
  });
}
