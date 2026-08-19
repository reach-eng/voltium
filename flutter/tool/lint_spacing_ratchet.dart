import 'dart:io';

/// DS-3d: Spacing discipline ratchet.
///
/// Counts raw `EdgeInsets.all(N)` and raw `SizedBox(width: N)` /
/// `SizedBox(height: N)` calls in `flutter/lib/` that bypass the
/// canonical `Spacing` design-system tokens.
///
/// This is a **ratchet-only** tool — it does not modify code.
/// To reduce the counts, replace raw literals with:
///   - `Spacing.paddingXs/Sm/Md/Lg/Xl`  (EdgeInsets.all)
///   - `SizedBox(height: Spacing.sm)`   (SizedBox)
///
/// Allowed exclusions:
///   - `lib/theme/app_theme.dart`       (canonical token definitions)
///   - `lib/theme/app_typography.dart`  (font-metric values only)
///   - Comment lines (`//`, `///`, `*`)
///   - `EdgeInsets.all(0)` / `EdgeInsets.all(0.0)` (zero padding)
///   - `EdgeInsets.all(Spacing.` calls (already using the token)
///   - `SizedBox(width: double.` / `SizedBox(height: double.` (infinity/zero)
///   - `SizedBox()` with no size argument (shrink-wrap)
///
/// Ceilings (measured 2026-08-04):
///   kEdgeInsetsCeiling = 110  (live: 106, +4 buffer)
///   kSizedBoxCeiling   = 1000 (live: 987, +13 buffer)
///
/// Usage:
///   cd flutter && dart run tool/lint_spacing_ratchet.dart
const int kEdgeInsetsCeiling = 110;
const int kSizedBoxCeiling = 1000;

void main() {
  final libDir = Directory('lib');
  if (!libDir.existsSync()) {
    stderr.writeln('Error: Run this script from the flutter/ directory.');
    exit(1);
  }

  const excludedPaths = {
    'lib/theme/app_theme.dart',
    'lib/theme/app_typography.dart',
  };

  // Regex patterns — line-level match.
  final edgeInsetsRaw = RegExp(r'EdgeInsets\.all\s*\(');
  final sizedBoxRaw = RegExp(r'SizedBox\s*\(\s*(width|height)\s*:\s*[\d]');

  int edgeInsetsCount = 0;
  int sizedBoxCount = 0;
  final edgeInsetsViolations = <String>[];
  final sizedBoxViolations = <String>[];

  for (final entity in libDir.listSync(recursive: true)) {
    if (entity is! File) continue;
    if (!entity.path.endsWith('.dart')) continue;

    final relativePath = entity.path.replaceAll('\\', '/');
    // Normalise to lib/... for exclusion matching.
    final libRelative = relativePath.contains('lib/')
        ? 'lib/${relativePath.split('lib/').last}'
        : relativePath;

    if (excludedPaths.any((e) => libRelative.endsWith(e.replaceAll('lib/', '')))) {
      continue;
    }

    final lines = entity.readAsLinesSync();
    for (var i = 0; i < lines.length; i++) {
      final line = lines[i];
      final trimmed = line.trimLeft();

      // Skip comment lines.
      if (trimmed.startsWith('//') ||
          trimmed.startsWith('///') ||
          trimmed.startsWith('*')) {
        continue;
      }

      // EdgeInsets.all() — exclude zero-padding and token-based calls.
      if (edgeInsetsRaw.hasMatch(line)) {
        // Skip EdgeInsets.all(0) and EdgeInsets.all(Spacing.
        if (!line.contains('EdgeInsets.all(0)') &&
            !line.contains('EdgeInsets.all(0.0)') &&
            !line.contains('EdgeInsets.all(Spacing.')) {
          edgeInsetsCount++;
          edgeInsetsViolations.add('${entity.path}:${i + 1}  $trimmed');
        }
      }

      // SizedBox(width/height: literal) — exclude double.infinity etc.
      if (sizedBoxRaw.hasMatch(line)) {
        if (!line.contains('double.') && !line.contains('Spacing.')) {
          sizedBoxCount++;
          sizedBoxViolations.add('${entity.path}:${i + 1}  $trimmed');
        }
      }
    }
  }

  // Report.
  final edgePassed = edgeInsetsCount <= kEdgeInsetsCeiling;
  final sizedPassed = sizedBoxCount <= kSizedBoxCeiling;

  stdout.writeln('── Spacing Ratchet ──────────────────────────────────');
  stdout.writeln(
      'EdgeInsets.all(raw): $edgeInsetsCount / $kEdgeInsetsCeiling  ${edgePassed ? "✓" : "✗ EXCEEDS CEILING"}');
  stdout.writeln(
      'SizedBox(raw):       $sizedBoxCount / $kSizedBoxCeiling  ${sizedPassed ? "✓" : "✗ EXCEEDS CEILING"}');

  if (!edgePassed) {
    stderr.writeln(
        '\nERROR: EdgeInsets.all count ($edgeInsetsCount) exceeds ceiling ($kEdgeInsetsCeiling).');
    stderr.writeln(
        'Replace raw EdgeInsets.all(N) with Spacing.paddingXs/Sm/Md/Lg/Xl.');
    stderr.writeln('First 10 violations:');
    for (final v in edgeInsetsViolations.take(10)) {
      stderr.writeln('  $v');
    }
  }

  if (!sizedPassed) {
    stderr.writeln(
        '\nERROR: SizedBox raw count ($sizedBoxCount) exceeds ceiling ($kSizedBoxCeiling).');
    stderr.writeln(
        'Replace raw SizedBox(height: N) with SizedBox(height: Spacing.sm) etc.');
    stderr.writeln('First 10 violations:');
    for (final v in sizedBoxViolations.take(10)) {
      stderr.writeln('  $v');
    }
  }

  if (!edgePassed || !sizedPassed) {
    exit(1);
  }

  stdout.writeln('Spacing ratchet passed.');
}
