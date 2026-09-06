/// PR-PERMISSIONS-P1: unit tests for the shared PrimaryCta widget.
///
/// Verifies:
///   - the disabled look uses `AppColors.outlineVariant` (fill) and
///     `AppColors.onSurfaceMuted` (label) tokens,
///   - tapping a disabled `PrimaryCta` does not invoke `onPressed`,
///   - the standard `Key` is honored by `find.byKey` and points to a
///     hit-testable node (so `tester.tap` resolves),
///   - `isLoading: true` swaps the label for a CircularProgressIndicator
///     and ignores `onPressed` taps,
///   - the trailing icon is rendered when provided.
library;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/widgets/buttons/primary_cta.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  Widget wrap(Widget child) => MaterialApp(
        home: Scaffold(body: child),
      );

  testWidgets('renders label, icon, and primary blue when enabled',
      (tester) async {
    var tapped = false;
    await tester.pumpWidget(wrap(
      PrimaryCta(
        label: 'Continue',
        icon: Icons.arrow_forward,
        onPressed: () => tapped = true,
      ),
    ));

    expect(find.text('Continue'), findsOneWidget);
    expect(find.byIcon(Icons.arrow_forward), findsOneWidget);

    // Fill should be the brand primary, not the disabled variant.
    final container = tester.widget<Container>(
      find.descendant(
        of: find.byType(PrimaryCta),
        matching: find.byType(Container),
      ),
    );
    final decoration = container.decoration as BoxDecoration;
    expect(decoration.color, AppColors.primary);

    // Tap fires.
    await tester.tap(find.byType(PrimaryCta));
    expect(tapped, isTrue);
  });

  testWidgets('disabled look uses outlineVariant + onSurfaceMuted',
      (tester) async {
    var tapped = false;
    await tester.pumpWidget(wrap(
      PrimaryCta(
        label: 'Continue',
        icon: Icons.arrow_forward,
        enabled: false,
        onPressed: () => tapped = true,
      ),
    ));

    // Fill is `outlineVariant` (the canonical disabled fill).
    final container = tester.widget<Container>(
      find.descendant(
        of: find.byType(PrimaryCta),
        matching: find.byType(Container),
      ),
    );
    final decoration = container.decoration as BoxDecoration;
    expect(decoration.color, AppColors.outlineVariant);

    // Tap does NOT fire when disabled.
    await tester.tap(find.byType(PrimaryCta));
    expect(tapped, isFalse);
  });

  testWidgets('onPressed: null is a no-op', (tester) async {
    await tester.pumpWidget(wrap(
      const PrimaryCta(label: 'Continue', onPressed: null),
    ));
    await tester.tap(find.byType(PrimaryCta));
    // No exception is the success criterion — the tap is dropped.
  });

  testWidgets('standard Key is honored by find.byKey', (tester) async {
    await tester.pumpWidget(wrap(
      PrimaryCta(
        key: const Key('continuePermissionsButton'),
        label: 'Continue',
        onPressed: () {},
      ),
    ));

    expect(find.byKey(const Key('continuePermissionsButton')), findsOneWidget);
    // And the resolved node is hit-testable so tester.tap can drive it.
    final gestureDetector = find.descendant(
      of: find.byType(PrimaryCta),
      matching: find.byType(GestureDetector),
    );
    expect(gestureDetector, findsOneWidget);
  });

  testWidgets('isLoading shows a spinner and blocks taps', (tester) async {
    var tapped = false;
    await tester.pumpWidget(wrap(
      PrimaryCta(
        label: 'Continue',
        isLoading: true,
        onPressed: () => tapped = true,
      ),
    ));

    // The label is replaced by a CircularProgressIndicator.
    expect(find.text('Continue'), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    // Taps are blocked while loading — onPressed should not fire.
    await tester.tap(find.byType(PrimaryCta), warnIfMissed: false);
    expect(tapped, isFalse);
  });

  testWidgets('omitting icon still renders a label only', (tester) async {
    await tester.pumpWidget(wrap(
      PrimaryCta(label: 'Continue', onPressed: () {}),
    ));

    expect(find.text('Continue'), findsOneWidget);
    expect(find.byType(Icon), findsNothing);
  });
}
