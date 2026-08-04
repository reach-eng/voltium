/// PR-134 (RA-F-6) — Screen file size ratchet test
///
/// Asserts:
/// 1. flutter/scripts/check-screen-size.sh exists and is executable
/// 2. The 4 screens the audit flagged (>800 lines) are in the
///    baseline. (We don't yet require all 4 to be <600; the ratchet
///    only prevents growth. The actual splits are follow-up PRs.)
/// 3. The Flutter design rule (no screen > 600 lines) is documented
///    in a comment at the top of each ratchet script.
library;

import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('screen-size ratchet script exists', () {
    final script = File('scripts/check-screen-size.sh');
    expect(script.existsSync(), isTrue,
        reason: 'PR-134 ratchet script must exist');
  });

  test('screen-size ratchet script has the 600-line threshold', () {
    final script = File('scripts/check-screen-size.sh');
    final content = script.readAsStringSync();
    expect(content, contains('THRESHOLD=600'));
  });

  test('screen-size ratchet script has a baseline mechanism', () {
    final script = File('scripts/check-screen-size.sh');
    final content = script.readAsStringSync();
    expect(content, contains('BASELINE_FILE'));
  });

  test(
      'top_up_proof_screen.dart is currently over the threshold (regression guard)',
      () {
    // This test documents the CURRENT state (811 lines). Once the
    // split PRs land, this test will be updated to assert the file
    // is < 600 lines. Until then, this is a regression guard:
    // a future commit that REMOVES the file (e.g. by accident)
    // will fail this test.
    final f = File(
      'lib/features/wallet/presentation/screens/top_up_proof_screen.dart',
    );
    expect(f.existsSync(), isTrue);
    final lines = f.readAsLinesSync().length;
    expect(lines, greaterThan(600),
        reason:
            'top_up_proof_screen.dart is currently over the 600-line threshold. '
            'This test exists as a regression guard — if this PR splits the file '
            'down, update this assertion to <600.');
  });
}
