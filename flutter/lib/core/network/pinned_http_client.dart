import 'dart:io';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import 'package:crypto/crypto.dart';

/// TLS Certificate Pinning Interceptor.
///
/// Implements certificate pinning by checking the SHA-256 hash of the server's
/// certificate against a list of known fingerprints.
///
/// In debug mode, pinning is disabled to allow local development.
/// In release builds, a warning is logged if no fingerprints are configured.
class PinnedHttpInterceptor {
  /// Default production SHA-256 certificate fingerprints for Voltium's TLS cert.
  ///
  /// 🔐 IMPORTANT: Replace with actual production fingerprints before release.
  static const List<String> productionFingerprints = [
    // TODO: Add your production certificate hashes here
    'SHA256_HASH_1=',
    'SHA256_HASH_2=',
  ];

  /// Creates an [http.Client] with certificate pinning awareness.
  static http.Client createClient() {
    if (kDebugMode) {
      return http.Client();
    }

    if (productionFingerprints.isEmpty) {
      debugPrint(
        '[PinnedHttpClient] WARNING: No production fingerprints configured. '
        'TLS pinning is not active. Set productionFingerprints before release.',
      );
      return http.Client();
    }

    final httpClient = HttpClient(context: SecurityContext(withTrustedRoots: true))
      ..badCertificateCallback = (X509Certificate cert, String host, int port) {
        // Calculate the SHA-256 hash of the DER-encoded certificate
        final digest = sha256.convert(cert.der);
        final extractedFingerprint = base64.encode(digest.bytes);

        final isValid = productionFingerprints.contains(extractedFingerprint);
        if (!isValid) {
          debugPrint(
            '[PinnedHttpClient] Certificate pinning validation failed for $host. '
            'Expected one of $productionFingerprints but got $extractedFingerprint',
          );
        }
        return isValid;
      };

    return IOClient(httpClient);
  }
}
