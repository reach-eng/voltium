import 'dart:io';

/// DARK-MODE-AUDIT 2026-08-14 — PR2 step 3: Static palette token ratchet.
///
/// PR2 lifted all light-only `AppColors.<lightToken>` references to the
/// brightness-aware `ThemeColors.of(context).<token>` extension. This ratchet
/// prevents drift back: any future `AppColors.<lightToken>` outside of
/// `lib/theme/app_theme.dart` (the canonical token home) is a regression
/// against the dark-mode migration.
///
/// **Tokens that MUST NOT appear as static references outside app_theme.dart**
/// (their `ThemeColors` equivalents are brightness-aware):
///   - `onSurfaceMuted`    → use `AppColors.of(context).onSurfaceMuted`
///   - `surfaceSubtle`     → use `AppColors.of(context).surfaceSubtle`
///   - `borderSubtle`      → use `AppColors.of(context).borderSubtle`
///   - `errorRose`         → use `AppColors.of(context).errorRose`
///   - `slate800`          → use `AppColors.of(context).onSurface`
///   - `successLight`      → use `AppColors.of(context).successLight`
///   - `errorLight`        → use `AppColors.of(context).errorLight`
///   - `warningLight`      → use `AppColors.of(context).warningLight`
///   - `infoLight`         → use `AppColors.of(context).infoLight`
///   - `primarySurface`    → use `AppColors.of(context).primarySurface`
///
/// **Tokens ALLOWED as static references** (genuine non-context call sites
/// that have no `BuildContext` in scope, e.g. model getters, constructor
/// defaults, top-level `const` values). Each allowed token MUST have a
/// justification comment in `lib/theme/app_theme.dart`:
///   - `iconBackground`    — used by `notification_model.dart::iconBgColor`
///                            and `streak_celebration_bar.dart` constructor
///                            defaults (no `BuildContext` available there)
///   - `surfaceBright`     — used internally by `app_theme.dart` in
///                            `ColorScheme.surfaceContainerLow` (file is
///                            excluded from the scan)
///   - `slate500`          — used by `earnings_entry_model.dart::platformColor`
///                            for the "other" platform (slate-500 muted);
///
/// **Excluded from the scan** (legitimate):
///   - `lib/theme/app_theme.dart`      (canonical definitions)
///   - `lib/theme/app_typography.dart` (no colors)
///   - Comment lines (`//`, `///`, `*`)
///
/// Usage:
///   cd flutter && dart run tool/lint_static_palette_tokens.dart
const Set<String> kForbiddenStaticTokens = {
  'onSurfaceMuted',
  'surfaceSubtle',
  'borderSubtle',
  'errorRose',
  'slate800',
  'successLight',
  'errorLight',
  'warningLight',
  'infoLight',
  'primarySurface',
};

const Set<String> kAllowedStaticTokens = {
  'iconBackground',
  'surfaceBright',
  'slate500',
};

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

  // Build a single regex matching any of the forbidden tokens: `AppColors.X`
  // where X is one of the forbidden names. Word boundaries prevent
  // `AppColors.surfaceBright2` from matching `surfaceBright`.
  final tokenAlt = kForbiddenStaticTokens.map(RegExp.escape).join('|');
  final forbiddenRe = RegExp(r'\bAppColors\.(' + tokenAlt + r')\b');

  int violationCount = 0;
  final violations = <String>[];

  for (final entity in libDir.listSync(recursive: true)) {
    if (entity is! File) continue;
    if (!entity.path.endsWith('.dart')) continue;

    final relativePath = entity.path.replaceAll('\\', '/');
    final libRelative = relativePath.contains('lib/')
        ? 'lib/${relativePath.split('lib/').last}'
        : relativePath;

    // Skip excluded canonical files
    if (excludedPaths
        .any((e) => libRelative == e || libRelative.endsWith('/${e.split('/').last}'))) {
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

      for (final match in forbiddenRe.allMatches(line)) {
        violationCount++;
        violations.add('${entity.path}:${i + 1}  $trimmed  ← AppColors.${match.group(1)}');
      }
    }
  }

  final passed = violationCount == 0;

  stdout.writeln('── Static Palette Token Ratchet (DARK-MODE-AUDIT 2026-08-14 PR2) ──');
  stdout.writeln(
      'Forbidden AppColors.* references outside app_theme.dart: $violationCount  ${passed ? "✓" : "✗ REGRESSION"}');

  if (!passed) {
    stderr.writeln(
        '\nERROR: $violationCount forbidden static palette token reference(s) found.');
    stderr.writeln(
        'These tokens are brightness-aware on ThemeColors — use the migration target:');
    stderr.writeln(
        '  AppColors.of(context).<token>   (or `final colors = AppColors.of(context);` then `colors.<token>`)');
    stderr.writeln('');
    stderr.writeln('Allowed static exceptions: ${kAllowedStaticTokens.join(', ')}');
    stderr.writeln('Forbidden tokens:');
    stderr.writeln('  ${kForbiddenStaticTokens.toList().join(', ')}');
    stderr.writeln('');
    stderr.writeln('Violations:');
    for (final v in violations) {
      stderr.writeln('  $v');
    }
    exit(1);
  }

  stdout.writeln('Static palette token ratchet passed.');
}
