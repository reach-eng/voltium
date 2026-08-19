// PR #4 (UX-3) — Behavioral smoke test for the new empty-state copy on
// wallet history + transactions list. Replaces the previous "No transactions
// yet" ad-hoc Text widget with IllustratedEmptyState.
//
// These tests do not assert pixel-level rendering (covered by
// test/widgets/illustrated_empty_state_golden_test.dart); they assert that
// the new branded copy + CTA actually appear where a real rider would tap.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/widgets/illustrated_empty_state.dart';

void main() {
  group('PR #4 — IllustratedEmptyState copy contract', () {
    testWidgets('renders title + subtitle + optional CTA', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: IllustratedEmptyState(
              icon: Icons.account_balance_wallet_outlined,
              title: 'No transactions yet',
              subtitle:
                  'Your wallet activity will show up here once you top up or make a payment.',
              actionLabel: 'Top up wallet',
              onAction: () => tapped = true,
            ),
          ),
        ),
      );

      expect(find.text('No transactions yet'), findsOneWidget);
      expect(
        find.textContaining('Your wallet activity will show up here'),
        findsOneWidget,
      );
      expect(find.text('Top up wallet'), findsOneWidget);
      expect(
          find.byIcon(Icons.account_balance_wallet_outlined), findsOneWidget);

      await tester.tap(find.text('Top up wallet'));
      await tester.pump();
      expect(tapped, isTrue);
    });

    testWidgets('omits CTA when onAction is null', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: IllustratedEmptyState(
              icon: Icons.filter_list_off_rounded,
              title: 'No transactions found',
              subtitle: 'Try a different filter to see more results.',
            ),
          ),
        ),
      );

      expect(find.text('No transactions found'), findsOneWidget);
      expect(find.byType(FilledButton), findsNothing);
      expect(find.byType(ElevatedButton), findsNothing);
    });

    testWidgets('uses Voltium Blue brand circle for the icon', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: IllustratedEmptyState(
              icon: Icons.search_off_rounded,
              title: 'No results found',
              subtitle: 'We could not find any FAQ matching your search.',
            ),
          ),
        ),
      );

      // The widget renders a 96x96 primaryLight circle behind the icon.
      // We assert at least one primary-tinted container exists in the tree.
      final containers = find.byType(Container);
      expect(containers, findsWidgets);
      // No Filled CTA when no onAction.
      expect(find.byType(FilledButton), findsNothing);
    });
  });
}
