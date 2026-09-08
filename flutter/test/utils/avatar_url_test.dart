import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/utils/avatar_url.dart';
import 'package:voltium_rider/utils/app_constants.dart';

void main() {
  group('resolveFileUrl & resolveAvatarUrl', () {
    test('returns null for null, empty, or whitespace-only inputs', () {
      expect(resolveFileUrl(null), isNull);
      expect(resolveFileUrl(''), isNull);
      expect(resolveFileUrl('   '), isNull);
      expect(resolveAvatarUrl(null), isNull);
    });

    test('rejects protocol-relative and unsafe schemes', () {
      expect(resolveFileUrl('//evil.com/avatar.png'), isNull);
      expect(resolveFileUrl('javascript:alert(1)'), isNull);
      expect(resolveFileUrl('file:///etc/passwd'), isNull);
    });

    test('passes through valid https URLs untouched', () {
      const url = 'https://storage.googleapis.com/voltium/avatars/rider1.png';
      expect(resolveFileUrl(url), url);
      expect(resolveAvatarUrl(url), url);
    });

    test('translates localhost URLs on Android emulator', () {
      const devUrl = 'http://localhost:8081/api/files/test.png';
      expect(
        resolveFileUrl(devUrl, isAndroid: true),
        'http://10.0.2.2:8081/api/files/test.png',
      );
      expect(
        resolveFileUrl(devUrl, isAndroid: false),
        'http://127.0.0.1:8081/api/files/test.png',
      );
    });

    test('resolves bare storage keys with download path', () {
      const key = 'riders/cm123/profile/avatar.jpg';
      final resolved = resolveFileUrl(key, isAndroid: true);
      expect(resolved, isNotNull);
      expect(resolved, contains('/api/files/download/$key'));
      expect(resolved, contains('10.0.2.2'));
    });

    test('strips leading slashes and path-traversal tokens', () {
      const traversalKey = '/../riders/avatar.png';
      final resolved = resolveFileUrl(traversalKey, isAndroid: false);
      expect(resolved, isNotNull);
      expect(resolved, isNot(contains('..')));
      expect(resolved, contains('/api/files/download/riders/avatar.png'));
    });

    test('AppConstants.resolveFileUrl and resolveProofUrl delegate correctly',
        () {
      const key = 'proofs/tx123.jpg';
      final fromAppConstants =
          AppConstants.resolveFileUrl(key, isAndroid: true);
      final fromProofUrl = AppConstants.resolveProofUrl(key, isAndroid: true);
      expect(fromAppConstants, fromProofUrl);
      expect(fromProofUrl, contains('/api/files/download/$key'));
    });
  });
}
