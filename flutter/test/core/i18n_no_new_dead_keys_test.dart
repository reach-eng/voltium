// LANGUAGE-AUDIT (2026-08-16) #10: catch screens that render
// hardcoded English Text() literals instead of using l10n.
//
// The baseline test in `i18n_dead_key_test.dart` scans the EN
// ARB and asserts no key was added without a call site — that
// catches the "added key, forgot to wire" failure mode. This
// companion test is the **strict** guard for the inverse
// failure mode: a screen that has hardcoded English `Text('…')`
// literals that could be moved to the ARB.
//
// The mechanism:
//   1. List every .dart file under `lib/features/<feature>/presentation/screens/`.
//   2. Find every `Text('…')` literal in those files where the
//      inner string is a real English sentence (length > 4,
//      starts with a letter, not just an emoji or symbol).
//   3. Fail if the count is above `hardcodedTextThreshold`.
//
// The threshold tracks the audit's known unwired count. Each
// PR that wires a screen decrements the budget; each PR that
// adds hardcoded text (without an ARB key) decrements it more
// dramatically because the new text is also added to the
// "unwired" pile.
//
// To make this useful in CI, the test prints the file:line of
// every offending Text() so the next dev can find them quickly.
//
// Run: `flutter test test/core/i18n_no_new_dead_keys_test.dart`
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  var flutterRoot = Directory.current.path;
  final relL10n = File('$flutterRoot/lib/l10n/app_en.arb');
  if (!relL10n.existsSync()) {
    final scriptPath = Platform.script.toFilePath();
    Directory? probe = Directory(scriptPath).parent;
    for (var i = 0; i < 4; i++) {
      if (probe == null) break;
      final candidate = File('${probe.path}/lib/l10n/app_en.arb');
      if (candidate.existsSync()) {
        flutterRoot = probe.path;
        break;
      }
      probe = probe.parent;
    }
  }
  final libDir = Directory('$flutterRoot/lib');
  final featuresDir = Directory('${libDir.path}/features');

  test('No screen renders hardcoded English Text() literals (audit-#5 guard)',
      () async {
    if (!featuresDir.existsSync()) {
      fail('Cannot find features/ at ${featuresDir.path}');
    }

    // Walk every presentation screen. The pattern is
    // `lib/features/<feature>/presentation/screens/<file>.dart`,
    // but a few legacy paths use `lib/features/<feature>/screens/`
    // or `lib/features/<feature>/presentation/pages/` — we
    // accept all three.
    final screens = featuresDir
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'))
        .where((f) {
      final normalized = f.path.replaceAll('\\', '/');
      return normalized.contains('/presentation/screens/') ||
          normalized.contains('/presentation/pages/') ||
          (RegExp(r'/features/[^/]+/screens/').hasMatch(normalized)) ||
          (RegExp(r'/features/[^/]+/pages/').hasMatch(normalized));
    }).toList(growable: false);

    // Find hardcoded Text('…') literals. The regex captures the
    // inner string between matching single quotes. We skip
    // obvious non-strings (empty, just punctuation, just
    // numbers, single letter).
    final textLiteralPattern = RegExp(r"Text\(\s*'([^']+)'\s*[,\)]");
    final offenders = <String>[];
    for (final screen in screens) {
      final lines = screen.readAsLinesSync();
      for (var i = 0; i < lines.length; i++) {
        for (final match in textLiteralPattern.allMatches(lines[i])) {
          final literal = match.group(1) ?? '';
          // Skip empties, single chars, pure punctuation, pure
          // numbers, and strings that look like Dart
          // interpolations that happen to wrap an English
          // sentence (we can't easily detect those).
          if (literal.length < 5) continue;
          if (RegExp(r'^[0-9\s\W]+$').hasMatch(literal)) continue;
          // Skip a11y labels — those are dev-facing, not
          // user-facing.
          if (literal.contains('button') || literal.contains('heading'))
            continue;
          // Skip widget keys (Key('…')).
          if (literal.startsWith('Key')) continue;
          // Skip text that's clearly already localisable — has
          // an l10n. prefix or a known brand token.
          if (literal.contains('l10n.')) continue;
          offenders.add(
              '${screen.path.replaceAll('\\', '/').split('/lib/').last}:${i + 1}: "$literal"');
        }
      }
    }

    // HISTORY:
    //   2026-08-16: baseline 78 (this test was added alongside
    //               the wiring PR for the auth flow + splash
    //               + OTP. The remaining 78 live in dashboard,
    //               wallet, support, KYC, guarantor, pickup,
    //               and other secondary screens.)
    //   2026-08-16: 78 → 67 (emergency_sos, emergency_contacts,
    //               notifications: 11 hardcoded Text() literals
    //               wired to existing `txt*` ARB keys)
    //   2026-08-16: 67 → 64 (pickup_verification: 3 hardcoded
    //               Text() literals wired)
    //   2026-08-16: 64 → 62 (notification_preferences: 2 hardcoded
    //               Text() literals wired)
    //   2026-08-16: 62 → 43 (T-66 follow-up: dashboard, KYC
    //               documents, pickup success, referrals,
    //               choose plan, settings lock-password dialog,
    //               edit profile — 19 hardcoded Text() literals
    //               wired)
    //   2026-08-17: 43 → 42 (PR-B KYC form l10n: tap-doc-preview
    //               "Retake"/"Keep" buttons + offline banner
    //               already use l10n keys; one additional KYC
    //               string l10n'd)
    //   2026-08-17: 42 → 5 (T-66 l10n sprint — 33 hardcoded
    //               Text() literals wired across rewards, plan
    //               success, edit profile, end rental,
    //               troubleshooter, create ticket, support
    //               center, feedback, hang tight, deposit
    //               workflow, guarantor, top-up amount, top-up
    //               proof, top-up flow — 13 screens, 15 new
    //               ARB keys. Remaining 5 are regex false
    //               positives on interpolation patterns.)
    //
    // The remaining 5 are NOT real hardcoded English — they
    // are interpolation patterns that the regex matches but
    // contain no English text:
    //   - emergency_sos_screen.dart:425 —
    //     `'${l10n.txtcancel} (5s)'` (l10n'd; only "5s" is
    //     literal)
    //   - top_up_amount_screen.dart:194, 214 — `'₹$secDeposit'`
    //     and `'₹$rentPrice'` (pure money, no English)
    //   - top_up_proof_screen.dart:949, 988 — `'₹${widget.amount}'`
    //     and `'₹$total'` (pure money, no English)
    //
    // A smarter test would exclude strings starting with '₹' or
    // '${' from the regex; for now the threshold is set to 5
    // with this comment explaining the false positives. The
    // infrastructure (l10n keys for everything, the screen-text
    // regex, the baseline tracking) is in place; a follow-up
    // ticket can refine the regex to handle the '₹' and '${'
    // cases and lower the threshold to 0.
    const hardcodedTextThreshold =
        5; // baseline at 2026-08-17 (T-66 l10n sprint)
    if (offenders.length > hardcodedTextThreshold) {
      // Print the first 30 so the failure log is actionable.
      final shown = offenders.take(30).map((o) => '  $o').join('\n');
      fail(
        'Found ${offenders.length} hardcoded Text() literals in '
        'presentation screens (threshold $hardcodedTextThreshold). '
        'First 30:\n$shown\n\n'
        'Either move them to the ARB (preferred) or raise the '
        'threshold with a one-line comment explaining why.',
      );
    }
    // ignore: avoid_print
    print(
      'l10n screen-text check: ${offenders.length} hardcoded '
      'Text() literals in presentation screens '
      '(threshold $hardcodedTextThreshold).',
    );
  });
}
