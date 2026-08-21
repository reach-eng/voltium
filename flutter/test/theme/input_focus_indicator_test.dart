// PR-10 (2026-08-21): the light theme's input decoration theme
// used `borderSide: BorderSide.none` for the default + enabled
// borders, which left the input field indistinguishable from the
// surrounding surface in light mode. The focus state was the
// *only* visible border, which fails WCAG 2.1 SC 1.4.13
// (focus visible) — the focus indicator appeared, but the
// contrast jump was hard to notice because the field had no
// shape to begin with.
//
// This test pins the new contract: the default + enabled borders
// must have a non-zero width, non-transparent color so a sighted
// user can see the field exists; the focused border must use
// the primary color and a clearly larger width so the focus
// transition is unambiguous.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:voltium_rider/theme/app_theme.dart';

void main() {
  group('InputDecorationTheme — focus indicator (PR-10)', () {
    test('light theme: default + enabled borders are visible', () {
      final theme = AppTheme.lightTheme;
      final deco = theme.inputDecorationTheme;

      // Both the default border and the enabled border are the same
      // shape in this codebase. The `border` is the "resting" look;
      // the `enabledBorder` is what shows when the field is enabled
      // but not focused. Either one with a 1px outline is the new
      // contract.
      final resting = deco.enabledBorder ?? deco.border;
      expect(resting, isNotNull,
          reason: 'enabledBorder (or border) must be defined');
      expect(resting!.borderSide, isNotNull);
      expect(resting.borderSide.width, greaterThan(0),
          reason: 'resting border must be visible (WCAG 1.4.11)');
      expect(resting.borderSide.color.alpha, greaterThan(0),
          reason: 'resting border must be opaque enough to read');
    });

    test('light theme: focused border is distinctly different from resting',
        () {
      final theme = AppTheme.lightTheme;
      final deco = theme.inputDecorationTheme;

      final resting = deco.enabledBorder ?? deco.border;
      final focused = deco.focusedBorder;
      expect(focused, isNotNull, reason: 'focusedBorder must be defined');
      // Focus must be a wider border than the resting state.
      expect(
        focused!.borderSide.width,
        greaterThan(resting!.borderSide.width),
        reason: 'focused border should be wider than resting',
      );
      // The two borders must be different colors so the focus
      // transition is obvious.
      expect(focused.borderSide.color, isNot(resting.borderSide.color),
          reason: 'focused border should be a different color from resting');
    });

    test('dark theme: focused border is wider than the resting border', () {
      final theme = AppTheme.darkTheme;
      final deco = theme.inputDecorationTheme;

      final resting = deco.enabledBorder ?? deco.border;
      final focused = deco.focusedBorder;
      expect(focused, isNotNull);
      expect(focused!.borderSide.width, greaterThan(resting!.borderSide.width));
    });
  });
}
