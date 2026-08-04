/// PR-127 (DS-C-3) — card widget consolidation test
///
/// Asserts:
/// 1. The 4 card widgets (TapCard, HoverCard, GlassCard, GradientCard)
///    still resolve from the old `package:voltium_rider/widgets/cards.dart`
///    import path (back-compat re-export shim).
/// 2. The new canonical `lib/widgets/cards/cards.dart` also exports
///    them.
/// 3. CardParallaxTilt (the duplicate of TiltCard) is removed.
library;

import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('old cards.dart re-export shim exists', () {
    final shim = File('lib/widgets/cards.dart');
    expect(shim.existsSync(), isTrue);
    final content = shim.readAsStringSync();
    expect(content, contains("export 'cards/cards.dart';"));
  });

  test('new cards/cards.dart has the 4 canonical card widgets', () {
    final f = File('lib/widgets/cards/cards.dart');
    expect(f.existsSync(), isTrue);
    final content = f.readAsStringSync();
    expect(content, contains('class TapCard'));
    expect(content, contains('class HoverCard'));
    expect(content, contains('class GlassCard'));
    expect(content, contains('class GradientCard'));
  });

  test('CardParallaxTilt duplicate widget is removed (PR-127 dedup)', () {
    final f = File('lib/widgets/card_parallax_tilt.dart');
    expect(f.existsSync(), isFalse,
        reason:
            'card_parallax_tilt.dart was a 29-line wrapper around TiltCard. '
            'TiltCard is the canonical answer; the wrapper was deleted in PR-127.');
  });

  test('TiltCard is the canonical parallax-tilt widget', () {
    final f = File('lib/widgets/tilt_card.dart');
    expect(f.existsSync(), isTrue);
    final content = f.readAsStringSync();
    expect(content, contains('class TiltCard'));
    expect(content, contains('maxTilt'));
  });

  test('active_dashboard_screen.dart now uses TiltCard (not CardParallaxTilt)',
      () {
    final f = File(
      'lib/features/dashboard/presentation/screens/active_dashboard_screen.dart',
    );
    expect(f.existsSync(), isTrue);
    final content = f.readAsStringSync();
    // The actual code path: TiltCard is the only widget imported +
    // used. The old CardParallaxTilt class name is allowed to appear
    // in COMMENTS (e.g. explaining the migration) but not in import
    // statements or build() calls.
    expect(content, contains('TiltCard'));
    expect(content,
        contains("import 'package:voltium_rider/widgets/tilt_card.dart';"));
    // The import for the deleted card_parallax_tilt.dart must be gone.
    expect(
      content,
      isNot(contains(
          "import 'package:voltium_rider/widgets/card_parallax_tilt.dart';")),
    );
    // The build() call must be TiltCard, not CardParallaxTilt.
    // We grep for `child: TiltCard(` (used) and `child: CardParallaxTilt(`
    // (would mean regression).
    expect(content, contains('child: TiltCard('));
    expect(content, isNot(contains('child: CardParallaxTilt(')));
  });
}
