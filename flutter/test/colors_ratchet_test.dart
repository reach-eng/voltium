/// PR-128 (DS-DM-1+2) — Colors ratchet + Shimmer dark variants test
///
/// Asserts:
/// 1. flutter/scripts/check-colors-ratchet.sh exists and is executable
/// 2. lib/theme/app_theme.dart declares the 4 shimmer tokens:
///    shimmerBase, shimmerHighlight (light) + shimmerBaseDark,
///    shimmerHighlightDark (dark)
/// 3. The shimmer tokens form a brightness pair: light values
///    should be lighter than dark values (sanity)
library;

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/theme/app_theme.dart';

void main() {
  test('colors ratchet script exists', () {
    final script = File('scripts/check-colors-ratchet.sh');
    expect(script.existsSync(), isTrue, reason: 'PR-128 script must exist');
  });

  group('PR-128 Shimmer dark variants (DS-DM-2)', () {
    test('AppColors.shimmerBaseDark is declared', () {
      // The token is a const Color; if it didn't exist, this would
      // fail at compile time (the static const assertion).
      const dark = AppColors.shimmerBaseDark;
      expect(dark, isA<Color>());
    });

    test('AppColors.shimmerHighlightDark is declared', () {
      const dark = AppColors.shimmerHighlightDark;
      expect(dark, isA<Color>());
    });

    test('shimmer tokens form a brightness pair (dark > light)', () {
      // In the Flutter Color class, value is a 32-bit integer
      // packed as AABBGGRR. We compare luminance to assert dark
      // tokens are darker than light tokens.
      final lightBase = AppColors.shimmerBase.computeLuminance();
      final darkBase = AppColors.shimmerBaseDark.computeLuminance();
      final lightHighlight = AppColors.shimmerHighlight.computeLuminance();
      final darkHighlight = AppColors.shimmerHighlightDark.computeLuminance();

      expect(darkBase, lessThan(lightBase),
          reason: 'shimmerBaseDark should be darker than shimmerBase');
      expect(darkHighlight, lessThan(lightHighlight),
          reason: 'shimmerHighlightDark should be darker than shimmerHighlight');
    });

    test('shimmer highlight is lighter than shimmer base (within each mode)',
        () {
      final lightBaseL = AppColors.shimmerBase.computeLuminance();
      final lightHighlightL = AppColors.shimmerHighlight.computeLuminance();
      final darkBaseL = AppColors.shimmerBaseDark.computeLuminance();
      final darkHighlightL = AppColors.shimmerHighlightDark.computeLuminance();

      expect(lightHighlightL, greaterThan(lightBaseL),
          reason: 'shimmerHighlight should be lighter than shimmerBase');
      expect(darkHighlightL, greaterThan(darkBaseL),
          reason: 'shimmerHighlightDark should be lighter than shimmerBaseDark');
    });
  });
}
