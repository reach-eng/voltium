import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/io_client.dart';
import 'package:voltium_rider/core/network/pinned_http_client.dart';

void main() {
  setUp(() {
    PinnedHttpInterceptor.debugModeOverride = null;
    PinnedHttpInterceptor.pinModeOverride = null;
    PinnedHttpInterceptor.clearTrustedCaCerts();
  });

  tearDown(() {
    PinnedHttpInterceptor.debugModeOverride = null;
    PinnedHttpInterceptor.pinModeOverride = null;
    PinnedHttpInterceptor.clearTrustedCaCerts();
  });

  group('PinnedHttpInterceptor — Mode Switch & Validation (FL-12)', () {
    test('debug mode allows client creation even with zero pins/CAs', () {
      PinnedHttpInterceptor.debugModeOverride = true;
      PinnedHttpInterceptor.pinModeOverride = 'off';

      // In debug mode, no exception is thrown even with empty pins/CAs
      final client = PinnedHttpInterceptor.createClient(expectedHost: 'api.voltium.in');
      expect(client, isNotNull);
    });

    test('release mode with mode=off throws StateError (D-P0-1 fail-closed)', () {
      PinnedHttpInterceptor.debugModeOverride = false;
      PinnedHttpInterceptor.pinModeOverride = 'off';

      expect(
        () => PinnedHttpInterceptor.createClient(expectedHost: 'api.voltium.in'),
        throwsA(isA<StateError>().having(
          (e) => e.message,
          'message',
          contains('TLS_PIN_MODE=off is not permitted in release builds'),
        )),
      );
    });

    test('ca mode throws StateError if no CA certificates registered (D-P0-1 fail-closed)', () {
      PinnedHttpInterceptor.debugModeOverride = false;
      PinnedHttpInterceptor.pinModeOverride = 'ca';
      PinnedHttpInterceptor.clearTrustedCaCerts();

      expect(
        () => PinnedHttpInterceptor.createClient(expectedHost: 'api.voltium.in'),
        throwsA(isA<StateError>().having(
          (e) => e.message,
          'message',
          contains('no trusted CA certificates configured'),
        )),
      );
    });

    test('ca mode builds IOClient when valid CA certificates are registered', () {
      PinnedHttpInterceptor.debugModeOverride = false;
      PinnedHttpInterceptor.pinModeOverride = 'ca';
      final certBytes = File('assets/certs/voltium-ca.pem').readAsBytesSync();
      PinnedHttpInterceptor.setTrustedCaCertBytes([certBytes]);

      final client = PinnedHttpInterceptor.createClient(expectedHost: 'api.voltium.in');
      expect(client, isA<IOClient>());
      expect(PinnedHttpInterceptor.pinnedHost, 'api.voltium.in');
    });

    test('hash mode throws StateError when zero fingerprints configured', () {
      PinnedHttpInterceptor.debugModeOverride = false;
      PinnedHttpInterceptor.pinModeOverride = 'hash';

      expect(
        () => PinnedHttpInterceptor.createClient(expectedHost: 'api.voltium.in'),
        throwsA(isA<StateError>().having(
          (e) => e.message,
          'message',
          contains('no production TLS fingerprints configured'),
        )),
      );
    });

    test('hash mode builds IOClient when fingerprints are registered', () {
      PinnedHttpInterceptor.debugModeOverride = false;
      PinnedHttpInterceptor.pinModeOverride = 'hash';
      PinnedHttpInterceptor.setDynamicPins(['AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=']);

      final client = PinnedHttpInterceptor.createClient(expectedHost: 'api.voltium.in');
      expect(client, isA<IOClient>());
      expect(PinnedHttpInterceptor.pinnedHost, 'api.voltium.in');
    });
  });
}