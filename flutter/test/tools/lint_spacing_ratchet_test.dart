/// DS-3d: Regression guard for the spacing discipline ratchet.
///
/// Asserts:
///   1. `flutter/tool/lint_spacing_ratchet.dart` exists.
///   2. Both ceiling constants (`kEdgeInsetsCeiling`, `kSizedBoxCeiling`) are present.
///   3. The EdgeInsets ceiling is ≤ 150 (sanity guard).
///   4. The SizedBox ceiling is ≤ 1100 (sanity guard).
///   5. The tool exits non-zero when violations exceed ceiling (exit(1) present).
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  group('DS-3d Spacing ratchet', () {
    late String toolSrc;

    setUpAll(() {
      final f = File('tool/lint_spacing_ratchet.dart');
      expect(f.existsSync(), isTrue,
          reason: 'lint_spacing_ratchet.dart must exist at flutter/tool/');
      toolSrc = f.readAsStringSync();
    });

    test('EdgeInsets ceiling constant is present', () {
      expect(toolSrc, contains('kEdgeInsetsCeiling'));
      final match =
          RegExp(r'kEdgeInsetsCeiling\s*=\s*(\d+)').firstMatch(toolSrc);
      expect(match, isNotNull);
      final ceiling = int.parse(match!.group(1)!);
      expect(ceiling, greaterThan(0));
      expect(ceiling, lessThanOrEqualTo(150),
          reason: 'EdgeInsets ceiling must be ≤ 150 (sanity)');
    });

    test('SizedBox ceiling constant is present', () {
      expect(toolSrc, contains('kSizedBoxCeiling'));
      final match = RegExp(r'kSizedBoxCeiling\s*=\s*(\d+)').firstMatch(toolSrc);
      expect(match, isNotNull);
      final ceiling = int.parse(match!.group(1)!);
      expect(ceiling, greaterThan(0));
      expect(ceiling, lessThanOrEqualTo(1100),
          reason: 'SizedBox ceiling must be ≤ 1100 (sanity)');
    });

    test('tool exits non-zero when violations exceed ceiling', () {
      expect(toolSrc, contains('exit(1)'));
      expect(toolSrc, contains('exceeds ceiling'));
    });

    test('tool excludes app_theme.dart', () {
      expect(toolSrc, contains("'lib/theme/app_theme.dart'"));
    });

    test('tool skips comment lines', () {
      expect(toolSrc, contains("trimmed.startsWith('//')"));
    });
  });
}
