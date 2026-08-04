/// PR Batch 3 (RA-F-7) — Touch Target Lint test
///
/// Asserts:
/// 1. flutter/tool/lint_touch_targets.dart exists
/// 2. kMinTouchTarget = 44.0 is defined in lib/utils/accessibility.dart
/// 3. a11yTouchTarget widget exists
/// 4. The lint tool references kTouchTargetViolationCeiling
library;

import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('flutter/tool/lint_touch_targets.dart exists', () {
    final f = File('tool/lint_touch_targets.dart');
    expect(f.existsSync(), isTrue);
  });

  test('kMinTouchTarget constant is 44.0 in accessibility.dart', () {
    final f = File('lib/utils/accessibility.dart');
    expect(f.existsSync(), isTrue);
    final content = f.readAsStringSync();
    expect(content, contains('kMinTouchTarget'));
    expect(content, contains('44.0'));
  });

  test('a11yTouchTarget widget exists with minSize param', () {
    final f = File('lib/utils/accessibility.dart');
    final content = f.readAsStringSync();
    expect(content, contains('Widget a11yTouchTarget'));
    expect(content, contains('minSize'));
  });

  test('lint tool has a ratchet ceiling', () {
    final f = File('tool/lint_touch_targets.dart');
    final content = f.readAsStringSync();
    expect(content, contains('kTouchTargetViolationCeiling'));
    expect(content, contains('int kTouchTargetViolationCeiling'));
  });

  test('lint tool exits non-zero when violations exceed ceiling', () {
    final f = File('tool/lint_touch_targets.dart');
    final content = f.readAsStringSync();
    expect(content, contains('exit(1)'));
    expect(content, contains('exceeds ceiling'));
  });
}
