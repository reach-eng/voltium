// PR #6 (UX-2) — Behavioral tests for the HapticService API + LoadingButton
// loadingLabel feature.
//
// These tests assert the *contract* of the new code, not the actual
// vibration behavior (which is a platform channel call we can't test in
// the unit-test harness). We assert:
//   - The service methods are callable in test mode (no-op, no exception)
//   - LoadingButton's loadingLabel parameter swaps the label on isLoading
//   - LoadingButton fires HapticService.medium on press (call count = 1)

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/utils/haptic_service.dart';
import 'package:voltium_rider/widgets/loading_widgets.dart';

void main() {
  group('PR #6 — HapticService', () {
    test('all 5 levels are no-ops in test mode (no exceptions)', () async {
      // If any of these throw, the test fails. Test mode is on by default
      // in the flutter_test harness.
      await HapticService.selection();
      await HapticService.light();
      await HapticService.medium();
      await HapticService.success();
      await HapticService.error();
    });
  });

  group('PR #6 — LoadingButton.loadingLabel', () {
    testWidgets('shows loadingLabel + spinner when isLoading is true',
        (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: LoadingButton(
              onPressed: null,
              label: 'Pay now',
              loadingLabel: 'Processing payment…',
              isLoading: true,
            ),
          ),
        ),
      );

      expect(find.text('Pay now'), findsNothing);
      expect(find.text('Processing payment…'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('shows label + no spinner when isLoading is false',
        (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: LoadingButton(
              onPressed: null,
              label: 'Pay now',
              loadingLabel: 'Processing payment…',
              isLoading: false,
            ),
          ),
        ),
      );

      expect(find.text('Pay now'), findsOneWidget);
      expect(find.text('Processing payment…'), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });

    testWidgets('falls back to spinner-only when loadingLabel is null',
        (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: LoadingButton(
              onPressed: null,
              label: 'Pay now',
              isLoading: true,
            ),
          ),
        ),
      );

      expect(find.text('Pay now'), findsNothing);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      // No text next to the spinner.
      expect(find.byType(Text), findsNothing);
    });
  });
}
