// T-118 (PR-6): the Permissions screen used to gate the rider on
// the OS denying all 9 required permissions. A rider who
// accidentally tapped "Don't allow" on Notifications was stuck —
// the only path forward was to back out of the screen, lose the
// onboarding context, and re-enter (and the new session also had
// the same problem).
//
// The fix: add a "Skip for now" button that surfaces a confirmation
// dialog and then invokes the same `onNext` callback the Continue
// button uses. The router doesn't know whether the rider skipped
// or fully granted — it routes to the next state either way. The
// settings page exposes a re-grant affordance for the rider to
// come back later.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/permissions_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

void main() {
  group('Permissions screen — T-118 (Skip button)', () {
    testWidgets('Skip button shows a confirmation dialog', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: const PermissionsScreen(),
          ),
        ),
      );
      // Permissions screen starts in a permission-checking async build.
      // Drain it before tapping.
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }

      // The Skip button is only visible when at least one required
      // permission is denied. The test runner is on Linux, so most
      // permissions are denied by default. Verify the button shows.
      final skipBtn = find.byKey(const Key('skipPermissionsButton'));
      expect(skipBtn, findsOneWidget,
          reason:
              'Skip button must be visible when permissions are not all granted');
      await tester.tap(skipBtn);
      for (var i = 0; i < 4; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }

      // Confirm dialog visible.
      expect(
        find.text('Skip granting permissions?'),
        findsOneWidget,
        reason: 'Skip confirm dialog must show',
      );
      expect(find.text('Skip anyway'), findsOneWidget);
    });

    testWidgets('Cancel keeps the rider on the Permissions screen',
        (tester) async {
      int navCount = 0;
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: PermissionsScreen(
              onNext: () => navCount++,
            ),
          ),
        ),
      );
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      await tester.tap(find.byKey(const Key('skipPermissionsButton')));
      for (var i = 0; i < 4; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      // Tap Cancel.
      await tester.tap(find.text('Cancel'));
      for (var i = 0; i < 4; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      // Dialog gone, no navigation.
      expect(find.text('Skip granting permissions?'), findsNothing);
      expect(navCount, 0);
    });

    testWidgets('Confirm invokes onNext once', (tester) async {
      int navCount = 0;
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: PermissionsScreen(
              onNext: () => navCount++,
            ),
          ),
        ),
      );
      for (var i = 0; i < 8; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      await tester.tap(find.byKey(const Key('skipPermissionsButton')));
      for (var i = 0; i < 4; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      // Tap "Skip anyway" to confirm.
      await tester.tap(find.byKey(const Key('confirmSkipPermissionsButton')));
      for (var i = 0; i < 4; i++) {
        await tester.pump(const Duration(milliseconds: 100));
      }
      expect(navCount, 1, reason: 'Confirm must invoke onNext exactly once');
    });
  });
}
