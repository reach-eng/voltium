import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/core/firebase/firebase_config.dart';
import 'package:voltium_rider/firebase_options.dart';

void main() {
  group('FirebaseConfig & DefaultFirebaseOptions', () {
    test(
        'throws MissingFirebaseConfigException when build-time dart-defines are absent',
        () {
      expect(
        () => FirebaseConfig.android,
        throwsA(isA<MissingFirebaseConfigException>()),
      );
      expect(
        () => FirebaseConfig.ios,
        throwsA(isA<MissingFirebaseConfigException>()),
      );
    });

    test(
        'DefaultFirebaseOptions does not contain hardcoded credentials in source',
        () {
      final file = File('lib/firebase_options.dart');
      expect(file.existsSync(), isTrue);
      final content = file.readAsStringSync();
      // Ensure no legacy API key patterns exist in the shim
      expect(content.contains('AIzaSy'), isFalse);
      expect(content.contains('apiKey:'), isFalse);
    });

    test('firebase_config.dart requires all keys via String.fromEnvironment',
        () {
      final file = File('lib/core/firebase/firebase_config.dart');
      expect(file.existsSync(), isTrue);
      final content = file.readAsStringSync();
      expect(content.contains('String.fromEnvironment'), isTrue);
      expect(content.contains('AIzaSy'), isFalse);
    });
  });
}
