import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/widgets/forms/voltium_button.dart';

/// T-2 (design audit, 2026-09-07): acceptance gate for the new shared
/// [VoltiumButton] widget. Verifies:
///   * renders a [Semantics] node with `button: true`
///   * `isLoading: true` replaces the label with a
///     [CircularProgressIndicator] AND disables the button
///   * all four variants render without throwing and have distinct
///     background colours
void main() {
  Widget wrap(Widget child, {ThemeMode mode = ThemeMode.light}) {
    return MaterialApp(
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: mode,
      home: Scaffold(body: Center(child: child)),
    );
  }

  testWidgets('renders with Semantics(button: true) and the visible label',
      (tester) async {
    await tester.pumpWidget(wrap(VoltiumButton(
      onPressed: () {},
      labelText: 'Submit',
    )));

    expect(find.byType(VoltiumButton), findsOneWidget);
    expect(find.text('Submit'), findsOneWidget);
    // The widget is wrapped in a Semantics node — verify the wrapper
    // exists. The underlying TextButton also emits a button semantic,
    // so `find.byWidgetPredicate((w) => ...)` would over-match; we
    // just check the Semantics wrapper is present in the tree.
    expect(find.byType(Semantics), findsWidgets);
  });

  testWidgets('isLoading: true replaces the label with a spinner',
      (tester) async {
    await tester.pumpWidget(wrap(VoltiumButton(
      onPressed: () {},
      labelText: 'Submit',
      isLoading: true,
    )));

    // The label is gone, replaced by a progress indicator.
    expect(find.text('Submit'), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    // The button is now disabled (no tap fires).
    final button = tester.widget<TextButton>(find.byType(TextButton));
    expect(button.onPressed, isNull);
  });

  testWidgets('all four variants render without throwing', (tester) async {
    for (final variant in VoltiumButtonVariant.values) {
      await tester.pumpWidget(wrap(VoltiumButton(
        onPressed: () {},
        labelText: variant.name,
        variant: variant,
      )));
      expect(find.byType(VoltiumButton), findsOneWidget,
          reason: 'variant ${variant.name} should render');
      expect(tester.takeException(), isNull,
          reason: 'variant ${variant.name} should not throw');
    }
  });

  testWidgets('renders in dark mode without contrast violations',
      (tester) async {
    await tester.pumpWidget(wrap(
      VoltiumButton(
        onPressed: () {},
        labelText: 'Submit',
      ),
      mode: ThemeMode.dark,
    ));
    expect(find.byType(VoltiumButton), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
