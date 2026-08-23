import 'dart:io';

/// PR-3 (F-003 — 2026-08-22 deep audit): ratchet for raw
/// `dart:developer.log` / `.log(...)` calls that leak to logcat in
/// release builds.
///
/// Mirrors `tool/lint_raw_colors.dart`. Use the canonical
/// `appDebug(...)` (gated on `kDebugMode` at
/// `lib/utils/app_logger.dart:52-56`) or the structured
/// `appLog`/`logApi`/`logAuth`/`logState` family instead.
///
/// **Excluded from counting** (legitimate uses):
///   - `lib/utils/app_logger.dart`        (defines `appDebug`)
///   - `lib/services/monitoring_service.dart`  (uses `appDebug` internally)
///   - `tool/**`                          (lint scripts themselves)
///   - Test files under `test/**`         (test debug helpers)
///   - Comment lines (`//`, `///`, `*`)
///
/// **Ceiling:** 0. The 49 known sites were replaced in PR-3; any new
/// `dart:developer.log` call must use `appDebug` instead.
///
/// Usage:
///   cd flutter && dart run tool/lint_raw_developer_log.dart
const int kRawDeveloperLogCeiling = 0;

void main() {
  final libDir = Directory('lib');
  if (!libDir.existsSync()) {
    stderr.writeln('Error: Run this script from the flutter/ directory.');
    exit(1);
  }

  const excludedPaths = {
    'lib/utils/app_logger.dart',
    'lib/services/monitoring_service.dart',
  };

  // Match:
  //   1. `import 'dart:developer'` (any variant)
  //   2. `developer.log(...)` / `log(...)` calls — the only safe
  //      replacement in PR-3 is `appDebug(...)`.
  final importRe = RegExp(r"""^\s*import\s+['"]dart:developer['"]""", multiLine: true);
  final callRe = RegExp(r'(^|\W)(?:developer\.)?log\s*\(');

  final files = libDir
      .listSync(recursive: true)
      .whereType<File>()
      .where((f) => f.path.endsWith('.dart'))
      .toList();

  final hits = <String>[];
  for (final f in files) {
    final relPath = f.path.replaceAll(r'\', '/');
    if (excludedPaths.contains(relPath)) continue;
    final src = f.readAsStringSync();
    final importHits = importRe.allMatches(src).length;
    final callHits = callRe.allMatches(src).length;
    final total = importHits + callHits;
    if (total > 0) {
      hits.add('$relPath: $total (imports=$importHits, calls=$callHits)');
    }
  }

  hits.sort();
  final total = hits.length;
  stderr.writeln('Raw dart:developer log sites: $total (ceiling: $kRawDeveloperLogCeiling)');
  for (final h in hits) {
    stderr.writeln('  $h');
  }

  if (total > kRawDeveloperLogCeiling) {
    stderr.writeln(
      '\n❌ F-003 regression: $total raw log sites exceed the ceiling of '
      '$kRawDeveloperLogCeiling. Use `appDebug(...)` (kDebugMode-gated) '
      'or the structured `appLog` family from `lib/utils/app_logger.dart`.',
    );
    exit(1);
  } else {
    stderr.writeln('\n✅ F-003 ratchet satisfied.');
  }
}
