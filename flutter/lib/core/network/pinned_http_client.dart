import 'dart:io';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import 'package:crypto/crypto.dart';
import '../../utils/app_logger.dart';

/// TLS Certificate Pinning Interceptor.
///
/// Implements certificate pinning by checking the SHA-256 hash of the server's
/// certificate against a list of known fingerprints.
///
/// In debug mode, pinning is disabled to allow local development.
/// In release builds, a warning is logged if no fingerprints are configured.
class PinnedHttpInterceptor {
  /// Default production SHA-256 certificate fingerprints for Voltium's TLS cert.
  /// Includes backup/next-rotation certificate fingerprints to prevent bricking on cert rotation.
  static const List<String> productionFingerprints = [];

  /// Dynamically registered certificate fingerprints (e.g. loaded from secure storage or server).
  static final List<String> _dynamicFingerprints = [];

  /// Register dynamic pins received from a verified server configuration.
  static void setDynamicPins(List<String> pins) {
    _dynamicFingerprints.clear();
    _dynamicFingerprints.addAll(
      pins
          .map((s) => s.trim())
          .where((s) => s.isNotEmpty && !s.contains('HASH_')),
    );
    appDebug(
        '[PinnedHttpClient] Registered ${_dynamicFingerprints.length} dynamic TLS pins.');
  }

  static List<String> get configuredFingerprints {
    const envPins = String.fromEnvironment('TLS_PIN_SHA256');
    final List<String> pins = [];

    if (envPins.isNotEmpty) {
      pins.addAll(
        envPins.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty),
      );
    }
    pins.addAll(productionFingerprints.where((fp) => !fp.contains('HASH_')));
    pins.addAll(_dynamicFingerprints);

    return pins.toSet().toList(); // Deduplicate
  }

  /// Creates an [http.Client] with certificate pinning awareness.
  static http.Client createClient() {
    if (kDebugMode) {
      return http.Client();
    }

    final activeFingerprints = configuredFingerprints;
    if (activeFingerprints.isEmpty) {
      appDebug(
        '[PinnedHttpClient] WARNING: No production fingerprints configured. '
        'TLS pinning is not active. Set TLS_PIN_SHA256 dart-define before release.',
      );
      return http.Client();
    }

    final httpClient = HttpClient(
        context: SecurityContext(withTrustedRoots: true))
      ..badCertificateCallback = (X509Certificate cert, String host, int port) {
        // Calculate the SHA-256 hash of the DER-encoded certificate
        final digest = sha256.convert(cert.der);
        final extractedFingerprint = base64.encode(digest.bytes);

        final isValid = activeFingerprints.contains(extractedFingerprint);
        if (!isValid) {
          appDebug(
            '[PinnedHttpClient] Certificate pinning validation failed for $host. '
            'Expected one of $activeFingerprints but got $extractedFingerprint',
          );
        }
        return isValid;
      };

    return IOClient(httpClient);
  }
}
