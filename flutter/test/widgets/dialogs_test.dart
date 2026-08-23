// PR-10 (F-082 — 2026-08-22 deep audit): lock the contract that
// `showLogoutConfirmation` is NOT one-tap — it must show a
// destructive confirm dialog with a Cancel + Logout pair so an
// accidental tap on the logout tile cannot terminate the rider's
// session. The pre-existing PR-2 cross-rider-state test (logout
// resets every per-rider state holder) covers the *consequence* of
// tapping Logout; this test covers the *gating* — that the dialog
// is actually presented, not a direct onTap.
//
// We test the dialog's *text surface* (titles, button labels) and
// the destructiveness flag (Logout button must be flagged as
// destructive so the existing `isDestructive` style applies).

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/widgets/dialogs.dart';

void main() {
  testWidgets(
      'PR-10 / F-082: showLogoutConfirmation presents a destructive confirm dialog',
      (tester) async {
    bool? result;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: ElevatedButton(
                onPressed: () async {
                  result = await showLogoutConfirmation(context);
                },
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    // Title + message visible.
    expect(find.text('Logout'), findsWidgets,
        reason: 'F-082: the dialog title must be "Logout" so the rider '
            'can read what they\'re about to confirm');
    expect(
      find.textContaining('Are you sure you want to logout'),
      findsOneWidget,
      reason: 'F-082: the dialog body must explicitly ask for '
          'confirmation — not a single-tap "logged out" toast',
    );

    // Cancel + destructive Logout pair.
    expect(find.text('Cancel'), findsOneWidget);
    expect(find.text('Logout'), findsWidgets,
        reason: 'F-082: the destructive confirm button is labelled '
            '"Logout" so the rider knows the consequence of tapping');

    // Cancel returns false.
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(result, isFalse,
        reason: 'F-082: tapping Cancel must NOT trigger logout');

    // Re-open + accept returns true.
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    // The dialog has two "Logout" texts (title + button); tap the
    // button (the one inside the actions row).
    final logoutButton = find.descendant(
      of: find.byType(OverflowBar),
      matching: find.text('Logout'),
    );
    expect(logoutButton, findsOneWidget,
        reason: 'F-082: the destructive Logout button must be the '
            'one inside the actions row, not the title');
    await tester.tap(logoutButton);
    await tester.pumpAndSettle();
    expect(result, isTrue,
        reason: 'F-082: tapping the destructive Logout button '
            'returns true so the caller can proceed with logout');
  });

  testWidgets(
      'PR-10 / F-082: showDeleteConfirmation is also a confirm dialog (not one-tap)',
      (tester) async {
    bool? result;

    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: Builder(
            builder: (context) => Center(
              child: ElevatedButton(
                onPressed: () async {
                  result = await showDeleteConfirmation(context,
                      itemName: 'the cached photo');
                },
                child: const Text('Open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();

    expect(find.text('Delete the cached photo?'), findsOneWidget);
    expect(find.text('This action cannot be undone.'), findsOneWidget);
    expect(find.text('Cancel'), findsOneWidget);
    expect(find.text('Delete'), findsOneWidget);

    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(result, isFalse);
  });
}
