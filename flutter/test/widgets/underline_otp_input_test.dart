// Voltium — UnderlineOtpInput widget tests
//
// Apple/Google-style OTP input: a single transparent TextField with N
// underline slots rendered behind it. These tests cover the public surface
// the OTP screen relies on: auto-advance, completion, error display, clear,
// and the `Key('otpInputRow')` that the E2E integration tests look for.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/widgets/underline_otp_input.dart';

void main() {
  Widget host(Widget child) => MaterialApp(home: Scaffold(body: child));

  testWidgets('renders 6 underline slots by default', (tester) async {
    await tester.pumpWidget(
      host(
        UnderlineOtpInput(
          onCompleted: (_) {},
        ),
      ),
    );

    expect(find.byKey(const Key('otpInputRow')), findsOneWidget);
    // 6 slot widgets (one per digit)
    expect(find.byKey(const ValueKey('underline_otp_0')), findsOneWidget);
    expect(find.byKey(const ValueKey('underline_otp_5')), findsOneWidget);
    // Underlying transparent TextField is mounted so the IME is wired up
    expect(find.byType(TextField), findsOneWidget);
  });

  testWidgets('calls onChanged and onCompleted when fully filled',
      (tester) async {
    final changes = <String>[];
    String? completed;

    await tester.pumpWidget(
      host(
        UnderlineOtpInput(
          onCompleted: (v) => completed = v,
          onChanged: changes.add,
        ),
      ),
    );

    final field = find.byType(TextField);
    await tester.enterText(field, '123456');
    await tester.pump();

    // In a widget test, enterText fires onChanged once with the full value
    // (not per-character — that's the IME's job on a real device).
    expect(changes, contains('123456'));
    expect(completed, '123456');
  });

  testWidgets('value getter mirrors controller text', (tester) async {
    final key = GlobalKey<UnderlineOtpInputState>();
    await tester.pumpWidget(
      host(
        UnderlineOtpInput(
          key: key,
          onCompleted: (_) {},
        ),
      ),
    );

    expect(key.currentState!.value, '');
    expect(key.currentState!.isComplete, isFalse);

    await tester.enterText(find.byType(TextField), '999999');
    await tester.pump();

    expect(key.currentState!.value, '999999');
    expect(key.currentState!.isComplete, isTrue);
  });

  testWidgets('clear() resets the value and refills the first slot',
      (tester) async {
    final key = GlobalKey<UnderlineOtpInputState>();
    await tester.pumpWidget(
      host(
        UnderlineOtpInput(
          key: key,
          onCompleted: (_) {},
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), '111222');
    await tester.pump();
    expect(key.currentState!.value, '111222');

    key.currentState!.clear();
    await tester.pump();

    expect(key.currentState!.value, '');
    expect(key.currentState!.isComplete, isFalse);
  });

  testWidgets('setError() displays the error text below the row',
      (tester) async {
    final key = GlobalKey<UnderlineOtpInputState>();
    await tester.pumpWidget(
      host(
        UnderlineOtpInput(
          key: key,
          onCompleted: (_) {},
        ),
      ),
    );

    expect(find.text('Invalid code'), findsNothing);
    key.currentState!.setError('Invalid code');
    await tester.pump();

    expect(find.text('Invalid code'), findsOneWidget);
  });

  testWidgets('overlong input is truncated to widget.length', (tester) async {
    final key = GlobalKey<UnderlineOtpInputState>();
    String? completed;
    await tester.pumpWidget(
      host(
        UnderlineOtpInput(
          key: key,
          onCompleted: (v) => completed = v,
        ),
      ),
    );

    // 8 digits into a 6-digit field — the IME may allow this on some
    // platforms, the widget must defensively truncate.
    await tester.enterText(find.byType(TextField), '12345678');
    await tester.pump();

    expect(key.currentState!.value.length, 6);
    expect(key.currentState!.value, '123456');
    expect(completed, '123456');
  });

  testWidgets('non-digit input is stripped to digits only', (tester) async {
    final key = GlobalKey<UnderlineOtpInputState>();
    await tester.pumpWidget(
      host(
        UnderlineOtpInput(
          key: key,
          onCompleted: (_) {},
        ),
      ),
    );

    await tester.enterText(find.byType(TextField), '1a2b3c');
    await tester.pump();

    expect(key.currentState!.value, '123');
  });

  testWidgets('respects custom length parameter', (tester) async {
    await tester.pumpWidget(
      host(
        UnderlineOtpInput(
          length: 4,
          onCompleted: (_) {},
        ),
      ),
    );

    expect(find.byKey(const ValueKey('underline_otp_0')), findsOneWidget);
    expect(find.byKey(const ValueKey('underline_otp_3')), findsOneWidget);
    expect(find.byKey(const ValueKey('underline_otp_4')), findsNothing);
  });
}
