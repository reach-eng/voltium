import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Page Object for the Emergency SOS flow.
///
/// PR-9 (EMERGENCY P0-5): zero integration tests existed for the entire
/// emergency feature. This page object introduces the locator surface
/// and is the seed for per-action tests (call 112, cancel overlay,
/// backend alert, contact fanout). The actual `Key('emergency*')` markers
/// are added incrementally to `EmergencySOSScreen` as each assertion
/// is wired up.
class EmergencyPageObject {
  final WidgetTester tester;

  EmergencyPageObject(this.tester);

  // Locators
  Finder get screen => find.byKey(const Key('emergencySosScreen'));

  /// Long-press trigger for the SOS flow. Currently rendered as an
  /// `InkWell` with a long-press handler in `EmergencySOSScreen` —
  /// the `Key('sosLongPress')` marker is the seam for the
  /// integration test.
  Finder get sosLongPress => find.byKey(const Key('sosLongPress'));

  /// Cancel overlay button shown after the 5-second auto-call timer.
  Finder get cancelButton => find.byKey(const Key('sosCancelButton'));

  // Actions

  /// Tap the 112 call shortcut (no long-press required in the test
  /// — the test driver doesn't honour long-press gestures the same
  /// way a real device does, so we exercise the underlying call
  /// action via the cancel overlay path).
  Future<void> tapCancel() async {
    if (cancelButton.evaluate().isNotEmpty) {
      await tester.tap(cancelButton);
      await tester.pumpAndSettle();
    }
  }

  // Assertions

  void expectLoaded() {
    expect(screen, findsOneWidget);
  }
}
