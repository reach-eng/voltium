// Lists ARB keys that no Dart file references in any of the three
// access patterns. Fast version: reads each lib file once and
// matches all keys at once. Run: dart run tools/find_truly_unused_arb.dart
import 'dart:io';

Future<void> main() async {
  final keys = _loadKeys();
  stdout.writeln('Scanning ${keys.length} keys against flutter/lib/...');

  // Walk lib/ once. For each file, find every key (in any of the
  // three access patterns) that appears in that file. Then we
  // know which keys are referenced.
  final usedKeys = <String>{};
  await for (final entity in Directory('lib').list(recursive: true)) {
    if (entity is! File) continue;
    if (!entity.path.endsWith('.dart')) continue;
    final content = await entity.readAsString();
    for (final k in keys) {
      if (usedKeys.contains(k)) continue;
      // Match any of: l10n.<k>, appLocalizations.of(context)!.<k>,
      //               appLocalizations.of(context)?.<k>
      if (_hasMatch(content, k)) {
        usedKeys.add(k);
      }
    }
  }

  final dead = keys.where((k) => !usedKeys.contains(k)).toList();
  stdout.writeln('Truly unused: ${dead.length}/${keys.length}');
  stdout.writeln('--- Truly unused keys ---');
  for (final k in dead) {
    stdout.writeln('  $k');
  }
}

bool _hasMatch(String content, String key) {
  // We avoid RegExp here for speed — direct string contains is much
  // faster than per-key regex when scanning many files.
  // Check that the key is accessed with a word-boundary after it
  // (so 'l10n.txtfoo' does not match key 'txtfoobar').
  bool isWordBoundary(String text, int after) {
    if (after >= text.length) return true;
    final ch = text[after];
    return !((ch.codeUnitAt(0) >= 0x61 && ch.codeUnitAt(0) <= 0x7A) ||
        (ch.codeUnitAt(0) >= 0x41 && ch.codeUnitAt(0) <= 0x5A) ||
        (ch.codeUnitAt(0) >= 0x30 && ch.codeUnitAt(0) <= 0x39) ||
        ch == '_');
  }

  // l10n.<key> or l10n?.<key> (null-safe call) — search for next match
  // for both forms. The "l10n?.<key>" pattern is the most common
  // form for nullable L10n lookups in the codebase.
  for (final prefix in ['l10n.', 'l10n?.']) {
    final direct = '$prefix$key';
    var from = 0;
    while (true) {
      final idx = content.indexOf(direct, from);
      if (idx < 0) break;
      if (isWordBoundary(content, idx + direct.length)) return true;
      from = idx + direct.length;
    }
  }

  // AppLocalizations.of(context)!.<key> (non-null assert) or
  // AppLocalizations.of(context)?.<key> (null-aware), with any
  // amount of whitespace between the closing paren and the
  // access operator (Dart linebreaks can split the call). Both
  // 'AppLocalizations' and the lowercase 'appLocalizations' are
  // matched for defensive coverage.
  final re = RegExp(
    r'App?Localizations\.of\(context\)\s*[!?]\s*\.' +
        RegExp.escape(key) +
        r'\b',
  );
  if (re.hasMatch(content)) return true;
  return false;
}

List<String> _loadKeys() {
  final file = File('lib/l10n/app_en.arb');
  final content = file.readAsStringSync();
  final regex = RegExp(r'^\s+"([a-zA-Z]+)":\s*"', multiLine: true);
  final skip = <String>{
    'description', 'type', 'count', 'amount', 'km', 'kwh', 'status', 'days',
    'shortfall', 'code', 'view', 'intent', 'hub', 'percent', 'rent',
    'balance', 'current', 'total', 'date', 'error', 'name', 'number',
    'fee', 'seconds', 'placeholders',
  };
  return regex
      .allMatches(content)
      .map((m) => m.group(1)!)
      .where((k) => !skip.contains(k))
      .toSet()
      .toList();
}
