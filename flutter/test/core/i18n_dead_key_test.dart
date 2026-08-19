// LANGUAGE-AUDIT (2026-08-16) #10/#14: catch dead ARB keys.
//
// Before this test, the only enforcement on ARB parity was the
// orphan check in `i18n_test.dart`, which verified that every HI
// key has a matching EN key. There was no check that any of the
// 512 EN keys were actually consumed in the Dart code — a key
// could be added to the ARB, never wired into a screen, and
// silently rot.
//
// This test scans every non-generated Dart file under `lib/` and
// verifies that each non-@ EN key has at least one of its
// representations (camelCase or snake_case) appear in the source.
// Generated files under `lib/gen/` are excluded — they're
// produced by `flutter gen-l10n` and would create a tautology
// where every key is "used" by the file that defines it.
//
// Run: `flutter test test/core/i18n_dead_key_test.dart`
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  // Resolve the flutter package root from the working directory.
  // `flutter test` runs with cwd == the package root, so a relative
  // path to lib/ works for both `flutter test` and `dart test`.
  // If cwd isn't the package root (e.g. when invoked from the IDE
  // with a different working dir), we fall back to walking up from
  // the script location.
  var flutterRoot = Directory.current.path;
  final relEn = File('$flutterRoot/lib/l10n/app_en.arb');
  if (!relEn.existsSync()) {
    // Walk up from Platform.script to find the package root
    // (the directory that contains `lib/l10n/app_en.arb`).
    final scriptPath = Platform.script.toFilePath();
    // scriptPath → <flutter>/test/core/i18n_dead_key_test.dart
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
  final arbEn = File('${libDir.path}/l10n/app_en.arb');

  test('Every non-@ EN ARB key has at least one Dart call site', () async {
    if (!arbEn.existsSync()) {
      fail('Cannot find app_en.arb at ${arbEn.path}');
    }

    // Build the set of all EN value keys (non-@).
    final enJson = jsonDecode(arbEn.readAsStringSync()) as Map<String, dynamic>;
    final enKeys =
        enJson.keys.where((k) => !k.startsWith('@')).toList(growable: false);

    // Build the set of all Dart source under lib/ excluding gen/.
    // We collect the entire concatenated text per file rather than
    // per-key for speed (single read per file, single substring
    // check per key).
    final dartFiles = libDir
        .listSync(recursive: true)
        .whereType<File>()
        .where((f) => f.path.endsWith('.dart'))
        .where((f) => !f.path.replaceAll('\\', '/').contains('/gen/'))
        .toList(growable: false);
    final dartText = dartFiles.map((f) => f.readAsStringSync()).join('\n');

    // Find dead keys. A key is "live" if its ARB identifier (as
    // emitted by `flutter gen-l10n`) appears at least once in any
    // Dart source file. The Voltium gen output preserves the ARB
    // key name verbatim — `settings_title` is the getter name, not
    // `settingsTitle` — so we just look for the raw key.
    //
    // We also check the camelCase form because some authors use
    // `l10n.settingsTitle` style in comments/strings even though
    // the generated getter is `settings_title`. A key that appears
    // in EITHER form is considered live.
    final deadKeys = <String>[];
    for (final key in enKeys) {
      final camel = _snakeToCamel(key);
      // Skip the trivial self-reference: a key whose snake form is
      // identical to its camel form (e.g. `appTitle`, `common`) is
      // always "live" if it exists in any gen/ file, but we
      // already excluded gen/, so we just count both forms.
      if (!dartText.contains(key) && !dartText.contains(camel)) {
        deadKeys.add(key);
      }
    }

    // Regression guard: the test is informational today because
    // the existing EN ARB has ~470 keys that have not yet been
    // wired into a screen (LANGUAGE-AUDIT 2026-08-16 finding #5:
    // 80+ screens are 100% hardcoded English). We track the
    // current count and fail only if it GROWS — the goal is to
    // wire the existing 470 over time, not to block CI on them
    // today.
    //
    // HISTORY:
    //   2026-08-16: baseline 475 (PR that added the test)
    //   2026-08-16: 475 → 470 (splash + auth flow wiring)
    //   2026-08-16: 470 → 462 (emergency_sos + emergency_contacts
    //               + notifications wiring)
    //   2026-08-16: 462 → 459 (pickup_verification wiring)
    //   2026-08-16: 459 → 457 (notification_preferences wiring)
    //   2026-08-16: 457 → 442 (T-66 follow-up: dashboard, KYC
    //               documents, pickup success, referrals, choose
    //               plan, settings lock-password dialog, edit
    //               profile — 15 existing txt* keys wired + 7
    //               new ARB keys added)
    //   2026-08-17: 442 → 363 (T-66 l10n sprint — 79 existing
    //               ARB keys consumed by the new wirings across
    //               rewards, plan success, end rental,
    //               troubleshooter, create ticket, support
    //               center, feedback, hang tight, deposit
    //               workflow, guarantor, top-up amount, top-up
    //               proof, top-up flow. 15 new ARB keys added.)
    //
    // To raise the bar, set [deadKeyRegressionThreshold] to a
    // lower number and clean up that many. A future PR can move
    // from "fail-on-growth" to "fail-on-any" as part of a clean
    // onboarding-audit follow-up.
    const deadKeyRegressionThreshold =
        363; // baseline at 2026-08-17 (T-66 l10n sprint)
    if (deadKeys.length > deadKeyRegressionThreshold) {
      fail(
        'Dead-key count grew from baseline '
        '$deadKeyRegressionThreshold to ${deadKeys.length}. '
        'New ARB keys were added without wiring them into a Dart '
        'call site. Either wire them in or remove them.\n\n'
        'First 20 dead keys: ${deadKeys.take(20).toList()}'
        '${deadKeys.length > 20 ? " (and ${deadKeys.length - 20} more)" : ""}',
      );
    }
    // Always print the count so a future PR can see the trend.
    // ignore: avoid_print
    print(
      'i18n dead-key check: ${deadKeys.length} dead / '
      '${enKeys.length} total '
      '(threshold $deadKeyRegressionThreshold)',
    );
  });
}

/// Convert an ARB snake_case key to the camelCase form that
/// `flutter gen-l10n` exposes on the `AppLocalizations` class.
///
/// e.g. `settings_english` → `settingsEnglish`
///      `common_rupeeAmount` → `commonRupeeAmount` (already camel)
String _snakeToCamel(String snake) {
  final parts = snake.split('_');
  if (parts.length == 1) return snake;
  final buf = StringBuffer(parts.first);
  for (var i = 1; i < parts.length; i++) {
    final p = parts[i];
    if (p.isEmpty) continue;
    buf.write(p[0].toUpperCase());
    buf.write(p.substring(1));
  }
  return buf.toString();
}
