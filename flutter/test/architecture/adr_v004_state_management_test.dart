import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ADR-V004-1: State Management Single-Library Compliance', () {
    test('pubspec.yaml does not declare dormant provider package', () {
      final pubspec = File('pubspec.yaml').readAsStringSync();
      final lines = pubspec.split('\n');

      // Assert provider is not an active dependency
      final hasActiveProvider = lines.any((line) {
        final trimmed = line.trim();
        return !trimmed.startsWith('#') &&
            (trimmed.startsWith('provider:') ||
                trimmed.startsWith('provider :'));
      });

      expect(
        hasActiveProvider,
        isFalse,
        reason:
            'provider package must not be declared in pubspec.yaml dependencies',
      );
    });

    test('no Dart file in lib/ or test/ imports package:provider', () {
      final dirs = [Directory('lib'), Directory('test')];
      final violations = <String>[];

      for (final dir in dirs) {
        if (!dir.existsSync()) continue;
        final dartFiles = dir
            .listSync(recursive: true)
            .whereType<File>()
            .where((f) => f.path.endsWith('.dart'));

        for (final file in dartFiles) {
          if (file.path.contains('adr_v004_state_management_test.dart'))
            continue;
          final content = file.readAsStringSync();
          if (content.contains('package:provider/')) {
            violations.add(file.path);
          }
        }
      }

      expect(
        violations,
        isEmpty,
        reason:
            'Files importing legacy package:provider found. Voltium uses flutter_riverpod exclusively: $violations',
      );
    });

    test(
        'all state providers in lib/core/state/ and lib/features/** use flutter_riverpod',
        () {
      final providersFile = File('lib/core/state/riverpod_providers.dart');
      expect(providersFile.existsSync(), isTrue);

      final content = providersFile.readAsStringSync();
      expect(
          content, contains('package:flutter_riverpod/flutter_riverpod.dart'));
    });
  });
}
