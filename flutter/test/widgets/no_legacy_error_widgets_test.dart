// PR #3 (UX-1) — Regression test: the two legacy error widget files must
// stay deleted. If a future PR re-introduces `ErrorStateWidget` or the
// `NetworkErrorWidget`/`RetryWidget` classes from the deleted
// `widgets/empty_state.dart`, this test fails before merge.

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  group('PR #3 — legacy error widgets stay deleted', () {
    test('widgets/error_state_widget.dart must not exist', () {
      final f = File('lib/widgets/error_state_widget.dart');
      expect(
        f.existsSync(),
        isFalse,
        reason: 'The legacy ErrorStateWidget file was deleted in PR #3. '
            'Use the canonical widgets/error_state.dart instead.',
      );
    });

    test('widgets/empty_state.dart must not exist', () {
      final f = File('lib/widgets/empty_state.dart');
      expect(
        f.existsSync(),
        isFalse,
        reason:
            'The legacy empty_state.dart (with NetworkErrorWidget/RetryWidget) '
            'was deleted in PR #3. Use widgets/error_state.dart instead.',
      );
    });

    test('canonical widgets/error_state.dart must exist', () {
      final f = File('lib/widgets/error_state.dart');
      expect(
        f.existsSync(),
        isTrue,
        reason: 'The canonical ErrorState widget must exist for the team.',
      );
    });
  });
}
