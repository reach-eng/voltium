import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Page Object for the pickup flow (`PickupHubScreen`).
///
/// PR-8 (PICKUP P0-1): the pickup module has zero integration tests; this
/// page object introduces the locator surface and a smoke test that
/// exercises the screen-reachability path. The full 5-step happy-path
/// (hub → vehicle → team leader → emergency contact → photos) is
/// covered incrementally — each step gets its own test as the test
/// keys get added to `PickupHubScreen`.
class PickupPageObject {
  final WidgetTester tester;

  PickupPageObject(this.tester);

  // Locators
  Finder get screen => find.byKey(const Key('pickupHubScreen'));

  /// Stepper "Continue" / "Next" CTA at the bottom of the screen.
  /// The screen has a 3-step linear flow; this advances to the next step.
  Finder get nextButton => find.byKey(const Key('pickupNextButton'));

  // Actions

  /// Tap the bottom CTA to advance to the next step in the flow.
  Future<void> tapNext() async {
    await tester.ensureVisible(nextButton);
    await tester.tap(nextButton);
    await tester.pumpAndSettle();
  }

  // Assertions

  /// Asserts the pickup hub screen has been pushed onto the navigator.
  void expectLoaded() {
    expect(screen, findsOneWidget);
  }
}
