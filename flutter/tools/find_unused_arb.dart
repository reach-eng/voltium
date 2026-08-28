// One-shot analysis helper: lists ARB keys that no Dart file references.
// Run: dart run tools/find_unused_arb.dart
import 'dart:io';

Future<void> main() async {
  final keys = _loadKeys();
  final unused = <String>[];
  for (final k in keys) {
    final has = await _keyUsed(k);
    if (!has) unused.add(k);
  }
  stdout.writeln('Total keys: ${keys.length}');
  stdout.writeln('Unused: ${unused.length}');
  stdout.writeln('--- Unused keys ---');
  for (final k in unused) {
    stdout.writeln('  $k');
  }
}

Future<bool> _keyUsed(String key) async {
  // The generated code references each key as e.g. l10n.txtfooBar;
  // production code typically uses l10n.txtfooBar or appLocalizations.txtfooBar.
  // We scan lib/ for the substring 'l10n.<key>' to catch both.
  final pattern = 'l10n.$key';
  final dir = Directory('lib');
  await for (final entity in dir.list(recursive: true)) {
    if (entity is! File) continue;
    if (!entity.path.endsWith('.dart')) continue;
    final content = await entity.readAsString();
    if (content.contains(pattern)) return true;
  }
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
