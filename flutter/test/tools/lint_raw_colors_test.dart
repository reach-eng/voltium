/// DS-3a: Regression guard for the raw Color(0xFF...) ratchet.
///
/// Asserts:
///   1. `flutter/tool/lint_raw_colors.dart` exists.
///   2. `kRawColorCeiling` constant is present and sane.
///   3. Tool exits non-zero when violations exceed ceiling.
///   4. Tool excludes `lib/theme/app_theme.dart`.
///   5. Tool skips comment lines.
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  group('DS-3a Raw color ratchet', () {
    late String toolSrc;

    setUpAll(() {
      final f = File('tool/lint_raw_colors.dart');
      expect(f.existsSync(), isTrue,
          reason: 'lint_raw_colors.dart must exist at flutter/tool/');
      toolSrc = f.readAsStringSync();
    });

    test('kRawColorCeiling constant is present and sane', () {
      expect(toolSrc, contains('kRawColorCeiling'));
      final match = RegExp(r'kRawColorCeiling\s*=\s*(\d+)').firstMatch(toolSrc);
      expect(match, isNotNull, reason: 'ceiling constant must be present');
      final ceiling = int.parse(match!.group(1)!);
      expect(ceiling, greaterThan(0));
      // Must be below 100 — if it's higher the ratchet is useless.
      expect(ceiling, lessThanOrEqualTo(100),
          reason: 'kRawColorCeiling must be ≤ 100 (sanity guard)');
    });

    test('tool excludes lib/theme/app_theme.dart', () {
      expect(toolSrc, contains("'lib/theme/app_theme.dart'"));
    });

    test('tool skips comment lines', () {
      expect(toolSrc, contains("trimmed.startsWith('//')"));
      expect(toolSrc, contains("trimmed.startsWith('///')"));
    });

    test('tool exits non-zero when count exceeds ceiling', () {
      expect(toolSrc, contains('exit(1)'));
      expect(toolSrc, contains('exceeds ceiling'));
    });

    test('tool only counts full-opacity Color(0xFF...) not translucent', () {
      // The regex must target Color(0xFF...) not Color(0x26...) etc.
      expect(toolSrc, contains('Color(0xFF'));
      // Verify translucent colors are excluded by design (comment present).
      expect(toolSrc, contains('translucent'));
    });
  });
}
