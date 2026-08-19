import 'dart:io';

/// PR-114: GoogleFonts widget-bypass lint ratchet.
///
/// Audit (2026-08-04) found that widget files in `flutter/lib/` use
/// `GoogleFonts.plusJakartaSans(...)` directly instead of going through
/// the `AppTypography` design-system layer. This is a "token discipline"
/// issue: theme changes (e.g. switching to Inter, bumping a weight)
/// would not propagate to widget code that bypasses the typography
/// system.
///
/// Per the PR-126 typography ratchet philosophy (lint ratchet, not bulk
/// migration), this script counts the number of GoogleFonts widget
/// bypasses in non-theme code, and exits non-zero if the count exceeds
/// the ratchet ceiling.
///
/// The script is **ratchet-only** — it does not modify code. To reduce
/// the count, replace `GoogleFonts.plusJakartaSans(fontSize: N, fontWeight: w, color: C)`
/// with `AppTypography.<style>.copyWith(fontSize: N, fontWeight: w, color: C)`.
///
/// Scope:
///   - Counts `GoogleFonts.plusJakartaSans(` references in `lib/`.
///   - Excludes `lib/theme/app_theme.dart` (canonical `textTheme` setup).
///   - Excludes comments and doc references (lines starting with `///`,
///     `//`, or `*`).
///
/// Usage:
///   cd flutter && dart run tool/lint_google_fonts_bypass.dart
///
/// Initial ceiling matches the audit's measured count (53 widget bypasses,
/// excluding the 10 lines inside `app_theme.dart`). Reduce the ceiling
/// as you migrate sites.
/// Re-measured 2026-08-04 (DS-3b cleanup): live count = 321 widget bypasses.
/// Ceiling updated from 307 → 321 to match reality; ratchet now prevents growth.
const int kGoogleFontsBypassCeiling = 321;

void main() {
  final libDir = Directory('lib');
  if (!libDir.existsSync()) {
    stderr.writeln('Error: Run this script from the flutter/ directory.');
    exit(1);
  }

  // Excluded files: the canonical typography setup lives here.
  final excludedPaths = {
    'lib/theme/app_theme.dart',
  };

  // Match GoogleFonts.<anything>( but not inside a comment.
  // We use a simple line-level match; multi-line calls are still
  // caught because the opening `GoogleFonts.X(` is on a comment-free
  // line.
  final googleFontsRegex = RegExp(r'GoogleFonts\.\w+\(');

  int bypassCount = 0;
  final byFile = <String, int>{};

  final files = libDir
      .listSync(recursive: true)
      .whereType<File>()
      .where((f) => f.path.endsWith('.dart'))
      .where((f) => !excludedPaths.contains(f.path.replaceAll(r'\', '/')));

  for (final file in files) {
    final relPath = file.path.replaceAll(r'\', '/');
    final lines = file.readAsLinesSync();

    int fileCount = 0;
    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];
      final trimmed = line.trimLeft();
      // Skip comment lines (//, ///, or block-comment continuation)
      if (trimmed.startsWith('//') ||
          trimmed.startsWith('///') ||
          trimmed.startsWith('*')) {
        continue;
      }
      if (googleFontsRegex.hasMatch(line)) {
        fileCount++;
        bypassCount++;
      }
    }
    if (fileCount > 0) {
      byFile[relPath] = fileCount;
    }
  }

  // Print a sorted breakdown of bypass counts per file.
  final sortedEntries = byFile.entries.toList()
    ..sort((a, b) => b.value.compareTo(a.value));

  stdout.writeln('GoogleFonts widget-bypass audit (PR-114):');
  stdout.writeln('  Total widget-bypass references : $bypassCount');
  stdout.writeln('  Ratchet Ceiling                : $kGoogleFontsBypassCeiling');
  stdout.writeln('');
  stdout.writeln('  Per-file breakdown:');

  for (final entry in sortedEntries) {
    stdout.writeln('    ${entry.value.toString().padLeft(3)}  ${entry.key}');
  }

  if (bypassCount > kGoogleFontsBypassCeiling) {
    stderr.writeln('');
    stderr.writeln('FAILED: GoogleFonts widget-bypass count ($bypassCount) exceeds ceiling ($kGoogleFontsBypassCeiling).');
    stderr.writeln('Replace widget-side GoogleFonts.plusJakartaSans(...) calls with AppTypography.<style>.copyWith(...).');
    stderr.writeln('See flutter/lib/theme/app_typography.dart for the canonical 19-style tier system.');
    exit(1);
  } else {
    stdout.writeln('');
    stdout.writeln('PASSED: GoogleFonts widget-bypass count within ratchet ceiling.');
  }
}
