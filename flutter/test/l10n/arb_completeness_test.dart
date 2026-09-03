import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('CMP-024: ARB Localization Completeness Audit', () {
    late Map<String, dynamic> enJson;
    late Map<String, dynamic> hiJson;
    late List<String> enStringKeys;
    late List<String> hiStringKeys;

    setUpAll(() {
      final enFile = File('lib/l10n/app_en.arb');
      final hiFile = File('lib/l10n/app_hi.arb');

      expect(enFile.existsSync(), isTrue, reason: 'app_en.arb must exist');
      expect(hiFile.existsSync(), isTrue, reason: 'app_hi.arb must exist');

      enJson = jsonDecode(enFile.readAsStringSync()) as Map<String, dynamic>;
      hiJson = jsonDecode(hiFile.readAsStringSync()) as Map<String, dynamic>;

      enStringKeys = enJson.keys.where((k) => !k.startsWith('@')).toList();
      hiStringKeys = hiJson.keys.where((k) => !k.startsWith('@')).toList();
    });

    test(
        'app_hi.arb contains 100% of all translatable keys in app_en.arb (0 missing)',
        () {
      final missingKeys =
          enStringKeys.where((k) => !hiJson.containsKey(k)).toList();

      expect(
        missingKeys,
        isEmpty,
        reason:
            'Missing Hindi translations in app_hi.arb for keys: $missingKeys',
      );
      expect(hiStringKeys.length, equals(enStringKeys.length));
    });

    test('app_hi.arb has no empty or blank translation values', () {
      final emptyKeys = <String>[];
      for (final key in enStringKeys) {
        final val = hiJson[key];
        if (val == null || (val is String && val.trim().isEmpty)) {
          emptyKeys.add(key);
        }
      }

      expect(
        emptyKeys,
        isEmpty,
        reason: 'Keys with empty translations in app_hi.arb: $emptyKeys',
      );
    });

    test('placeholder variables match between English and Hindi translations',
        () {
      final placeholderRegex = RegExp(r'\{([a-zA-Z0-9_]+)\}');
      final mismatchedPlaceholders = <String, Map<String, dynamic>>{};

      for (final key in enStringKeys) {
        final enVal = enJson[key];
        final hiVal = hiJson[key];
        if (enVal is String && hiVal is String) {
          // Skip ICU plurals where placeholders are handled inside sub-clauses
          if (enVal.contains(', plural,')) continue;

          final enMatches = placeholderRegex
              .allMatches(enVal)
              .map((m) => m.group(1)!)
              .toSet();
          final hiMatches = placeholderRegex
              .allMatches(hiVal)
              .map((m) => m.group(1)!)
              .toSet();

          if (!enMatches.containsAll(hiMatches) ||
              !hiMatches.containsAll(enMatches)) {
            mismatchedPlaceholders[key] = {
              'en': enMatches.toList(),
              'hi': hiMatches.toList(),
            };
          }
        }
      }

      expect(
        mismatchedPlaceholders,
        isEmpty,
        reason: 'Placeholder mismatches found: $mismatchedPlaceholders',
      );
    });
  });
}
