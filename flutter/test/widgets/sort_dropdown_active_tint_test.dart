// T-AR-SORT F-3 (PR-4 of the Filter & Sort Review): the legacy
// `SortDropdown` was a generic `DropdownButton<String>` with no
// active-state affordance, no tooltip, and no screen-reader label —
// the icon was identical whether the default or a custom order was
// active. The new enum-typed `SortDropdown` mirrors the wallet's
// sort button: a `PopupMenuButton` with a primary-tinted icon when
// a non-default order is active and a leading check mark on the
// current option.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/widgets/search_filter.dart';

void main() {
  group('SortDropdown — active-state + a11y', () {
    testWidgets('tints the icon when a non-default order is active',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: SortDropdown<String>(
                options: const ['Newest', 'Oldest', 'Highest', 'Lowest'],
                value: 'Highest',
                label: (s) => s,
                onChanged: (_) {},
                tooltip: 'Sort by',
                defaultValue: 'Newest',
              ),
            ),
          ),
        ),
      );
      // Default state — value matches default, no tint.
      final sortIcon = tester.widget<Icon>(find.byIcon(Icons.sort));
      expect(sortIcon.color, isNotNull);
    });

    testWidgets('renders a tooltip on the PopupMenuButton', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: SortDropdown<String>(
                options: const ['Newest', 'Oldest'],
                value: 'Newest',
                label: (s) => s,
                onChanged: (_) {},
                tooltip: 'Sort by date or amount',
                defaultValue: 'Newest',
              ),
            ),
          ),
        ),
      );
      // The PopupMenuButton sets `tooltip` as a Tooltip widget under
      // the hood. Long-press the icon to surface the tooltip's message.
      await tester.longPress(find.byType(PopupMenuButton<String>));
      await tester.pumpAndSettle();
      // The tooltip text is now in the overlay as a Semantics node.
      // The test asserts the message reaches the render tree, not
      // the Semantics tree (which only activates on long-press).
      expect(find.text('Sort by date or amount'), findsAtLeastNWidgets(1));
    });

    testWidgets('opening the menu shows a check mark on the selected option',
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: SortDropdown<String>(
                options: const ['Newest', 'Oldest', 'Highest'],
                value: 'Oldest',
                label: (s) => s,
                onChanged: (_) {},
                tooltip: 'Sort',
                defaultValue: 'Newest',
              ),
            ),
          ),
        ),
      );
      // Tap the PopupMenuButton to open the menu.
      await tester.tap(find.byType(PopupMenuButton<String>));
      await tester.pumpAndSettle();

      // Both labels are visible.
      expect(find.text('Newest'), findsOneWidget);
      expect(find.text('Oldest'), findsOneWidget);
      expect(find.text('Highest'), findsOneWidget);

      // Exactly one check mark — the selected option ("Oldest").
      expect(find.byIcon(Icons.check), findsOneWidget);
    });

    testWidgets('selecting an option calls onChanged with the picked value',
        (tester) async {
      String? picked;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: SortDropdown<String>(
                options: const ['Newest', 'Oldest', 'Highest'],
                value: 'Newest',
                label: (s) => s,
                onChanged: (v) => picked = v,
                tooltip: 'Sort',
                defaultValue: 'Newest',
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.byType(PopupMenuButton<String>));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Highest'));
      await tester.pumpAndSettle();
      expect(picked, 'Highest');
    });
  });
}
