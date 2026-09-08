import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

class DashboardPageObject {
  final WidgetTester tester;

  DashboardPageObject(this.tester);

  // Locators
  Finder get dashboardTab => find.byKey(const Key('dashboardTab'));
  Finder get notificationBell => find.byKey(const Key('notificationBell'));
  // P2: no points badge exists on the dashboard (rewards live on the
  // Rewards screen) — the old key could never match. Assert the wallet
  // card, which is always rendered for an active rider, instead.
  Finder get walletCard => find.byKey(const Key('walletCard'));
  // Legacy alias kept for test 36, which taps it defensively
  // (`if isNotEmpty`). Do not use in new tests.
  Finder get pointsBadge => find.byKey(const Key('pointsBadge'));
  Finder get assignedVehicleCard =>
      find.byKey(const Key('assignedVehicleCard'));
  Finder get copyReferralButton => find.byKey(const Key('copyReferralButton'));

  Finder get markAllReadButton => find.byKey(const Key('markAllReadButton'));

  Finder get notificationCard => find.byKey(const Key('notificationCard'));

  Finder get hubCard => find.byKey(const Key('hubCard'));

  Finder get planCard_0 => find.byKey(const Key('planCard_0'));

  Finder get confirmPlanButton => find.byKey(const Key('confirmPlanButton'));

  Finder get confirmHubButton => find.byKey(const Key('confirmHubButton'));

  Finder get endRentalButton => find.byKey(const Key('endRentalButton'));

  Finder get cancelReturnButton => find.byKey(const Key('cancelReturnButton'));

  Finder get processReturnButton =>
      find.byKey(const Key('processReturnButton'));

  Finder get cancelReturnProcessButton =>
      find.byKey(const Key('cancelReturnProcessButton'));

  // Actions
  Future<void> tapNotificationBell() async {
    await tester.tap(notificationBell);
    await tester.pumpAndSettle();
  }

  // Assertions
  void expectLoaded() {
    expect(dashboardTab, findsOneWidget);
    expect(notificationBell, findsOneWidget);
    expect(walletCard, findsOneWidget);
    expect(assignedVehicleCard, findsOneWidget);
    expect(copyReferralButton, findsOneWidget);
  }
}
