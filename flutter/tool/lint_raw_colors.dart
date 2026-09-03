import 'dart:io';

/// DS-3a: Raw `Color(0xFF...)` literal ratchet.
///
/// The PR-114 font ratchet prevents new `GoogleFonts.plusJakartaSans(...)`
/// widget bypasses. This companion ratchet prevents new raw color literals
/// from creeping into widget code. The canonical pattern is to use
/// `AppColors.<token>` or `ThemeColors.of(context).<token>` instead.
///
/// **Excluded from counting** (legitimate uses):
///   - `lib/theme/app_theme.dart`       (canonical token definitions)
///   - `lib/theme/app_typography.dart`  (no colors, but for safety)
///   - Comment lines (`//`, `///`, `*`)
///   - Opacity-prefixed hex with alpha < 0xFF (e.g. `Color(0x26...)`,
///     `Color(0x40...)`, `Color(0x0A...)`) — these are translucent
///     overlay values that have no token equivalent yet.
///
/// **Ceiling** (measured 2026-08-04, after excluding app_theme.dart):
///   Non-theme widget raw colors ≈ 30 (conservative buffer from raw 130
///   total minus ~100 in app_theme.dart itself and AppShadows).
///
/// Usage:
///   cd flutter && dart run tool/lint_raw_colors.dart
const int kRawColorCeiling = 30;

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

  // Match Color(0xFF...) — full-opacity hex literals only (first byte = FF).
  // Color(0x26...), Color(0x40...) etc. are translucent and excluded.
  final rawColorRe = RegExp(r'\bColor\(0xFF[0-9A-Fa-f]{6}\)');

  int count = 0;
  final violations = <String>[];

  for (final entity in libDir.listSync(recursive: true)) {
    if (entity is! File) continue;
    if (!entity.path.endsWith('.dart')) continue;

    final relativePath = entity.path.replaceAll('\\', '/');
    final libRelative = relativePath.contains('lib/')
        ? 'lib/${relativePath.split('lib/').last}'
        : relativePath;

    if (excludedPaths
        .any((e) => libRelative.endsWith(e.replaceAll('lib/', '')))) {
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

      if (rawColorRe.hasMatch(line)) {
        count++;
        violations.add('${entity.path}:${i + 1}  $trimmed');
      }
    }
  }

  final passed = count <= kRawColorCeiling;

  stdout.writeln('── Raw Color Ratchet ────────────────────────────────');
  stdout.writeln(
      'Color(0xFF...) outside app_theme.dart: $count / $kRawColorCeiling  ${passed ? "✓" : "✗ EXCEEDS CEILING"}');

  if (!passed) {
    stderr.writeln(
        '\nERROR: Raw color count ($count) exceeds ceiling ($kRawColorCeiling).');
    stderr.writeln(
        'Replace Color(0xFF...) with AppColors.<token> or ThemeColors.of(context).<token>.');
    stderr.writeln('All violations:');
    for (final v in violations) {
      stderr.writeln('  $v');
    }
    exit(1);
  }

  stdout.writeln('Raw color ratchet passed.');
}
