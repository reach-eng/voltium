import 'dart:io';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import 'package:crypto/crypto.dart';
import '../../utils/app_logger.dart';

/// TLS Certificate Pinning Interceptor.
///
/// AUDIT FIX (workflows P0-D — TLS pinning was fail-open): the previous
/// implementation built the context with `withTrustedRoots: true` and only
/// compared pins inside `badCertificateCallback`. Dart invokes that callback
/// EXCLUSIVELY when default chain validation fails — so any certificate that
/// chained to a system root completed the handshake without the pin ever
/// being evaluated. A mis-issued CA certificate for our API host was a full
/// MITM with zero enforcement.
///
/// NEW MODEL — trust nothing, pin everything:
///   * The context is created with `withTrustedRoots: false` and no anchors,
///     so default validation ALWAYS fails and the callback adjudicates EVERY
///     handshake.
///   * The callback accepts a connection only when BOTH hold:
///       1. `host == pinnedHost`  (set from the API base URL)
///       2. SHA-256(cert DER) matches one of the configured fingerprints
///   * Cross-origin hosts (e.g. signed-URL uploads to S3/GCS) must NOT use
///     this client — use [createExternalClient], which keeps standard system
///     validation and never carries the API bearer token.
///
/// Debug builds bypass pinning entirely. Release builds with zero
/// configured fingerprints throw at startup (D-P0-1) rather than shipping
/// unpinned.
class PinnedHttpInterceptor {
  /// Default production SHA-256 certificate fingerprints for Voltium's TLS cert.
  /// Includes backup/next-rotation certificate fingerprints to prevent bricking on cert rotation.
  static const List<String> productionFingerprints = [];

  /// Dynamically registered certificate fingerprints.
  ///
  /// SECURITY NOTE: pins received over the channel they protect are circular
  /// (a first-connection MITM can register its own fingerprint). If dynamic
  /// provisioning is ever enabled, the payload MUST be verified against an
  /// out-of-band signature/HMAC before reaching this method.
  static final List<String> _dynamicFingerprints = [];

  /// The single hostname this client is allowed to talk to. Set by
  /// `ApiClient` from the resolved base URL before the first request.
  static String? pinnedHost;

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

  /// Creates the PINNED client for the Voltium API host.
  ///
  /// [expectedHost] is enforced inside the pin callback — a mismatched host
  /// is rejected regardless of certificate validity.
  static http.Client createClient({required String expectedHost}) {
    if (kDebugMode) {
      return http.Client();
    }

    final activeFingerprints = configuredFingerprints;
    if (activeFingerprints.isEmpty) {
      // DEEP-AUDIT D-P0-1: never silently disable TLS pinning in release.
      throw StateError(
        'PinnedHttpClient: no production TLS fingerprints configured. '
        'Build the release with --dart-define=TLS_PIN_SHA256="<hash1>,<hash2>" '
        'or set DynamicPins via PinnedHttpInterceptor.setDynamicPins() at '
        'app start. See pinned_http_client.dart for the deployment checklist.',
      );
    }

    pinnedHost = expectedHost;

    // Trust NOTHING: every handshake fails default validation and is
    // adjudicated below. This is what makes the pin enforce on every
    // connection instead of only on already-broken chains.
    final httpClient = HttpClient(
      context: SecurityContext(withTrustedRoots: false),
    )..badCertificateCallback = (X509Certificate cert, String host, int port) {
        if (host != pinnedHost) {
          appDebug(
            '[PinnedHttpClient] Rejected unexpected host $host (pinned: $pinnedHost)',
          );
          return false;
        }
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

  /// Plain system-validated client for CROSS-ORIGIN hosts (signed-URL
  /// uploads to storage providers). Never used for the pinned API host and
  /// never given the session bearer token (see ApiClient.putRaw/uploadFile).
  static http.Client createExternalClient() => http.Client();
}
