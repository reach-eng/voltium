// R2.2 — Regression test: catches dead `AppColors` definitions before they ship.
//
// Reads `flutter/lib/theme/app_theme.dart` and counts call-sites in
// `flutter/lib/`. Fails the test if any color has 0 call-sites (i.e. is dead
// code). This locks in the post-R2.2 cleanup so future drift is caught early.
//
// Allowed exceptions: colors used exclusively in `app_theme.dart` itself
// (e.g. `white` for the gradient spark) or referenced from `app_theme.dart`
// via `AppColors.xxx` (which would be self-references).

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

void main() {
  group('AppColors dead-code guard (R2.2)', () {
    test('no AppColors.* constant has 0 call-sites in lib/', () {
      final themeFile = File('lib/theme/app_theme.dart');
      final libDir = Directory('lib');

      expect(themeFile.existsSync(), isTrue,
          reason: 'app_theme.dart not found at expected path');
      expect(libDir.existsSync(), isTrue,
          reason: 'lib/ directory not found');

      final themeContent = themeFile.readAsStringSync();

      // Extract `static const Color (\w+) = Color(...)` declarations.
      final declaredNames = <String>[];
      final declRe =
          RegExp(r'static const Color (\w+) = Color\(');
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
          .where((e) => e.value == 0)
          .map((e) => e.key)
          .toList()
        ..sort();

      expect(
        dead,
        isEmpty,
        reason:
            'Dead AppColors constants found (0 call-sites in lib/): ${dead.join(', ')}.\n'
            'Either remove them or add a comment explaining why they are kept '
            '(e.g. exported for plugin consumption).',
      );
    });
  });
}
