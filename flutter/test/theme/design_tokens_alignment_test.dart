// PR-125 (DS-T-4 + T-5, 2026-08-04) — design-tokens.json ↔ app_typography.dart
// alignment ratchet.
//
// Reads the canonical tier definitions from `flutter/lib/theme/app_typography.dart`
// and the JSON token file at the repo root, then asserts every one of the 19
// tiers matches on `fontSize` and `fontWeight`. Catches drift between the
// cross-language source of truth (JSON) and the Flutter source of truth.
//
// Why not use the existing `app_colors_no_dead_test.dart` pattern? That test
// only counts call-sites for color tokens. Typography is structural (each
// tier has hardcoded fontSize + fontWeight values) so we parse the source
// directly instead of scanning call-sites.

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

// Canonical 19 tiers, in the order they appear in `app_typography.dart`.
// Each entry is parsed from the source file at test-time; this list is the
// structural ratchet: if a tier is added or removed, the test must be updated
// alongside the source. We also use this list to assert the JSON has all
// expected keys and no stale renamed keys.
const List<String> _canonicalTierOrder = [
  // 1. Display
  'displayLarge',
  'displayMedium',
  // 2. Headings
  'headingLarge',
  'headingMedium',
  'headingSmall',
  // 3. Titles
  'titleLarge',
  'titleMedium',
  'titleSmall',
  // 4. Body
  'bodyLarge',
  'bodyMedium',
  'bodySmall',
  // 5. Labels
  'labelLarge',
  'labelMedium',
  'labelSmall',
  // 6. Utility
  'overline',
  'otpDigit',
  'priceDisplay',
  // 7. Code
  'codeMedium',
  'codeLarge',
];

// Stale names that used to be in design-tokens.json before PR-125. This list
// is the negative ratchet: if any of these appear in the JSON, the test
// fails. Add new names to the canonical list (or the allowlist with
// rationale) rather than re-introducing these.
const Set<String> _bannedStaleJsonNames = {
  'utilityMono', // pre-R2.1 prototype; replaced by otpDigit
  'utilityCaption', // pre-R2.1 prototype; replaced by priceDisplay
};

class _TierSpec {
  const _TierSpec({
    required this.tier,
    required this.fontSize,
    required this.fontWeight,
    this.fontFamily,
  });
  final String tier;
  final int fontSize;
  final int fontWeight;
  final String? fontFamily;

  @override
  String toString() => '$tier(fontSize: $fontSize, fontWeight: $fontWeight'
      '${fontFamily == null ? '' : ', fontFamily: $fontFamily'})';
}

/// Parses `flutter/lib/theme/app_typography.dart` and returns the canonical
/// tier specs. Recognizes lines of the form:
///   `static const TextStyle <name> = TextStyle(`
///   `    fontSize: <int>,`
///   `    fontWeight: FontWeight.w<int>,`
///   `(optional) fontFamily: monoFontFamily,` → maps to 'JetBrains Mono'
///   `(optional) fontFamily: fontFamily,` → maps to 'Plus Jakarta Sans'
/// Multi-tier entries are not supported (this file is flat).
List<_TierSpec> _parseAppTypography(File file) {
  final lines = file.readAsLinesSync();
  final specs = <_TierSpec>[];
  String? currentTier;
  int? currentSize;
  int? currentWeight;
  String? currentFamily;

  final declRe = RegExp(r'static const TextStyle (\w+) = TextStyle\(');
  final sizeRe = RegExp(r'^\s*fontSize:\s*(\d+)');
  final weightRe = RegExp(r'FontWeight\.w(\d+)');
  final familyRe = RegExp(r'^\s*fontFamily:\s*(\w+)');

  for (final raw in lines) {
    final decl = declRe.firstMatch(raw);
    if (decl != null) {
      // Flush previous.
      if (currentTier != null && currentSize != null && currentWeight != null) {
        specs.add(_TierSpec(
          tier: currentTier,
          fontSize: currentSize,
          fontWeight: currentWeight,
          fontFamily: currentFamily,
        ));
      }
      currentTier = decl.group(1);
      currentSize = null;
      currentWeight = null;
      currentFamily = null;
      continue;
    }
    final size = sizeRe.firstMatch(raw);
    if (size != null && currentTier != null) {
      currentSize = int.parse(size.group(1)!);
    }
    final weight = weightRe.firstMatch(raw);
    if (weight != null && currentTier != null) {
      currentWeight = int.parse(weight.group(1)!);
    }
    final family = familyRe.firstMatch(raw);
    if (family != null && currentTier != null) {
      currentFamily = family.group(1);
    }
  }
  // Flush last.
  if (currentTier != null && currentSize != null && currentWeight != null) {
    specs.add(_TierSpec(
      tier: currentTier,
      fontSize: currentSize,
      fontWeight: currentWeight,
      fontFamily: currentFamily,
    ));
  }
  return specs;
}

/// Parses `design-tokens.json` and returns the typography block as a map.
Map<String, dynamic> _parseJsonTypography(File file) {
  final raw = jsonDecode(file.readAsStringSync()) as Map<String, dynamic>;
  final tokens = raw['tokens'] as Map<String, dynamic>?;
  if (tokens == null) {
    throw StateError('design-tokens.json: missing top-level "tokens" key');
  }
  final typography = tokens['typography'] as Map<String, dynamic>?;
  if (typography == null) {
    throw StateError('design-tokens.json: missing "tokens.typography" key — '
        'see docs/design-system.md §2.5 (PR-125 cleanup) for the canonical 19 tiers');
  }
  return typography;
}

String? _mapFontFamily(String? token) {
  if (token == null) return null;
  switch (token) {
    case 'fontFamily':
      return 'Plus Jakarta Sans';
    case 'monoFontFamily':
      return 'JetBrains Mono';
    default:
      return token;
  }
}

void main() {
  group('design-tokens.json ↔ app_typography.dart alignment (PR-125)', () {
    test('app_typography.dart has all 19 canonical tiers', () {
      final file = File('lib/theme/app_typography.dart');
      expect(file.existsSync(), isTrue,
          reason: 'app_typography.dart not found at expected path');
      final specs = _parseAppTypography(file);
      final names = specs.map((s) => s.tier).toSet();
      for (final expected in _canonicalTierOrder) {
        expect(names, contains(expected),
            reason:
                'Canonical tier "$expected" missing from app_typography.dart. '
                'Either add it to the source file or update '
                '_canonicalTierOrder in this test (and document why).');
      }
      // Also catch reverse: tiers in the source that aren't in the canonical
      // list. New tiers must be added to _canonicalTierOrder and the docs
      // table simultaneously.
      for (final actual in names) {
        expect(_canonicalTierOrder, contains(actual),
            reason:
                'Tier "$actual" exists in app_typography.dart but is not in '
                'the canonical list. Add it to _canonicalTierOrder and to '
                'docs/design-system.md §2 (the canonical 19-style table).');
      }
      expect(specs.length, 19,
          reason: 'Expected exactly 19 canonical tiers; got ${specs.length}');
    });

    test('design-tokens.json has all 19 canonical tiers (no stale names)', () {
      final file = File('../design-tokens.json');
      expect(file.existsSync(), isTrue,
          reason:
              'design-tokens.json not found at repo root. Run from flutter/ '
              'or update the relative path.');
      final json = _parseJsonTypography(file);

      // Banned stale names.
      for (final banned in _bannedStaleJsonNames) {
        expect(json.containsKey(banned), isFalse,
            reason: 'design-tokens.json still contains stale tier "$banned" '
                '(removed in PR-125). Update the JSON to use the canonical '
                'name (see _canonicalTierOrder).');
      }

      // Required canonical names.
      for (final expected in _canonicalTierOrder) {
        expect(json.containsKey(expected), isTrue,
            reason: 'design-tokens.json is missing canonical tier "$expected". '
                'See docs/design-system.md §2.5 (PR-125 cleanup).');
      }

      // No extras: JSON should not have tiers outside the canonical set
      // (catches accidental re-additions of old names).
      for (final key in json.keys) {
        expect(_canonicalTierOrder, contains(key),
            reason: 'design-tokens.json has unknown tier "$key" that is not in '
                'the canonical 19. Remove it or add it to the canonical list '
                'and the docs.');
      }
    });

    test(
        'every tier matches between design-tokens.json and app_typography.dart',
        () {
      final dartFile = File('lib/theme/app_typography.dart');
      final jsonFile = File('../design-tokens.json');
      final specs = _parseAppTypography(dartFile);
      final json = _parseJsonTypography(jsonFile);

      final byName = {for (final s in specs) s.tier: s};
      final mismatches = <String>[];

      for (final tier in _canonicalTierOrder) {
        final spec = byName[tier];
        final token = json[tier] as Map<String, dynamic>?;
        if (spec == null || token == null) {
          // Covered by the previous tests; skip here.
          continue;
        }
        final jsonSize = token['fontSize'];
        final jsonWeight = token['fontWeight'];
        final jsonFamily = token['fontFamily'] as String?;

        if (jsonSize != spec.fontSize) {
          mismatches.add(
              '$tier.fontSize: JSON=$jsonSize, app_typography.dart=${spec.fontSize}');
        }
        if (jsonWeight != spec.fontWeight) {
          mismatches.add(
              '$tier.fontWeight: JSON=$jsonWeight, app_typography.dart=${spec.fontWeight}');
        }
        // fontFamily is optional in the JSON (defaults to Plus Jakarta Sans
        // for body tiers, but explicit on the mono code tiers).
        final expectedFamily = _mapFontFamily(spec.fontFamily);
        if (jsonFamily != null &&
            expectedFamily != null &&
            jsonFamily != expectedFamily) {
          mismatches.add(
              '$tier.fontFamily: JSON=$jsonFamily, app_typography.dart=$expectedFamily');
        }
      }

      expect(mismatches, isEmpty,
          reason: 'design-tokens.json and app_typography.dart diverge on '
              '${mismatches.length} tier(s):\n  - ${mismatches.join('\n  - ')}\n'
              'See docs/design-system.md §2.5 (PR-125 cleanup) for the '
              'canonical values.');
    });
  });
}
