// R2.2 — Regression test: catches dead `AppColors` definitions before they ship.
//
// Reads `flutter/lib/theme/app_theme.dart` and counts call-sites in
// `flutter/lib/`. Fails the test if any color has 0 call-sites (i.e. is dead
// code). This locks in the post-R2.2 cleanup so future drift is caught early.
//
// Allowed exceptions:
//   - colors used exclusively in `app_theme.dart` itself (e.g. `white` for the
//     gradient spark) — `app_theme.dart` is excluded from the scan
//   - colors in the `allowedKeepSet` below, which are the "Group 7 candidates
//     for R2.2 part 2" still kept in the file (low usage; consolidation is
//     tracked as a separate PR per `docs/design-system.md` §2.5)

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

// Keep-list for low-usage "Group 7" colors that the R2.2 audit explicitly
// documented as still-in-use, not-yet-consolidated. Each entry is intentionally
// allowed; do NOT add a color here unless it has a corresponding row in
// `docs/design-system.md` §2.5 "Group 7 candidates for R2.2 part 2".
//
// DARK-MODE-AUDIT 2026-08-14 PR2: the `xxxLight` / `surfaceBright` /
// `surfaceSubtle` / `borderSubtle` / `errorRose` / `slate800` static
// tokens were migrated to `AppColors.of(context).X` (brightness-aware).
// Their static values are kept ONLY for:
//   - internal use by `app_theme.dart` (`surfaceBright` in
//     `ColorScheme.surfaceContainerLow`)
//   - non-context call sites in `notification_model.dart` and
//     `streak_celebration_bar.dart` (intentionally out of scope)
const Set<String> allowedKeepSet = {
  'accentPurpleSurface', // migrated to ThemeColors / alpha
  'amberIcon',
  'amberIconSurface',
  'borderDefault',
  'borderSubtle', // see PR2 note above
  'dangerText',
  'errorLight', // see PR2 note above
  'errorSurface', // migrated to ThemeColors.errorLight
  'infoLight', // see PR2 note above
  'onSurfaceMuted', // legacy back-compat (0xFF737785); ThemeColors variant is the canonical muted text color
  'orangeAccent',
  'orangeAccentBorder',
  'orangeAccentDark',
  'orangeAccentSurface',
  'primarySurface', // see PR2 note above
  'purpleIcon',
  'purpleIconSurface',
  'purpleLightSurface',
  'royalBlue',
  'royalBlueStrong',
  'royalBlueTint',
  'skySpark',
  'skySparkSurface',
  'successBorderLight',
  'successLight', // see PR2 note above
  'successOutline',
  'successTint',
  'surfaceBright', // see PR2 note above; used in `app_theme.dart` ColorScheme
  'surfaceHover',
  'surfaceSubtle', // see PR2 note above
  'tealIcon',
  'tealIconSurface',
  'warningLight', // see PR2 note above
  'white70',
};

void main() {
  group('AppColors dead-code guard (R2.2)', () {
    test('no AppColors.* constant has 0 call-sites in lib/', () {
      final themeFile = File('lib/theme/app_theme.dart');
      final libDir = Directory('lib');

      expect(themeFile.existsSync(), isTrue,
          reason: 'app_theme.dart not found at expected path');
      expect(libDir.existsSync(), isTrue, reason: 'lib/ directory not found');

      final themeContent = themeFile.readAsStringSync();

      // Extract `static const Color (\w+) = Color(...)` declarations.
      final declaredNames = <String>[];
      final declRe = RegExp(r'static const Color (\w+) = Color\(');
      for (final m in declRe.allMatches(themeContent)) {
        declaredNames.add(m.group(1)!);
      }

      // Count `AppColors.<name>` references across lib/, excluding app_theme.dart itself
      final usageCounts = <String, int>{};
      for (final name in declaredNames) {
        usageCounts[name] = 0;
      }

      for (final entity in libDir.listSync(recursive: true)) {
        if (entity is! File) continue;
        if (!entity.path.endsWith('.dart')) continue;
        if (entity.path.endsWith('app_theme.dart')) continue;

        final content = entity.readAsStringSync();
        for (final name in declaredNames) {
          // Dart's RegExp doesn't support \Q...\E; interpolate the name directly.
          // The names are identifier-safe (alphanumeric + underscore) so this is safe.
          final re = RegExp('AppColors\\.$name\\b');
          usageCounts[name] =
              (usageCounts[name] ?? 0) + re.allMatches(content).length;
        }
      }

      final dead = usageCounts.entries
          .where((e) => e.value == 0 && !allowedKeepSet.contains(e.key))
          .map((e) => e.key)
          .toList()
        ..sort();

      // Cross-check: any allowedKeepSet entry should actually be declared,
      // otherwise it's a stale entry in the allowlist.
      final staleAllowlist = allowedKeepSet
          .where((name) => !declaredNames.contains(name))
          .toList()
        ..sort();

      expect(staleAllowlist, isEmpty,
          reason: 'allowedKeepSet has entries that are no longer declared in '
              'app_theme.dart (remove them from the allowlist): '
              '${staleAllowlist.join(', ')}');

      expect(
        dead,
        isEmpty,
        reason:
            'Dead AppColors constants found (0 call-sites in lib/): ${dead.join(', ')}.\n'
            'Either remove them, add them to `allowedKeepSet` if they are a '
            'documented Group 7 candidate, or add a comment explaining why '
            'they are kept (e.g. exported for plugin consumption).',
      );
    });
  });
}
