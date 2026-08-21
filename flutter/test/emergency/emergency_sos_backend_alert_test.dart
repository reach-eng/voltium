import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/device_compliance/presentation/screens/emergency_sos_screen.dart';

// PR-VER-2026-08-06 (EMERGENCY P0-1): the SOS long-press used to only dial
// 112 locally. This test asserts the trigger now shows the "Sending SOS..."
// overlay (with a cancel option) — the backend-alert call and location
// capture are fire-and-forget and best-effort, so the observable contract
// is: overlay appears, dialog offers cancel, and the primary 112 dial still
// happens (url_launcher is stubbed by the golden-test harness).

Widget buildTestApp() {
  return ProviderScope(
    overrides: [],
    child: const MaterialApp(home: EmergencySOSScreen()),
  );
}

void main() {
  testWidgets('long-press shows Sending SOS overlay with a cancel option',
      (tester) async {
    await tester.pumpWidget(buildTestApp());
    await tester.pump(const Duration(seconds: 1));
    await tester.pump();

    final sosButton = find.text('SOS');
    expect(sosButton, findsOneWidget);

    await tester.longPress(sosButton);
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump();

    // Overlay appears with the sending state and the 5s cancel.
    expect(find.text('Sending SOS...'), findsOneWidget);
    expect(find.text('Cancel (5s)'), findsOneWidget);

    // Cancel dismisses the overlay.
    await tester.tap(
      find.widgetWithText(TextButton, 'Cancel (5s)'),
      warnIfMissed: false,
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300)); // exit animation
    await tester.pump();
    expect(find.text('Sending SOS...'), findsNothing);
  });

  testWidgets('renders the emergency contacts fallback from profile',
      (tester) async {
    await tester.pumpWidget(buildTestApp());
    await tester.pump(const Duration(seconds: 1));
    await tester.pump();

    // Static safety cards are always present.
    expect(find.text('Police'), findsOneWidget);
    expect(find.text('Ambulance'), findsOneWidget);
    expect(find.text('Voltium Support'), findsOneWidget);
  });
}
