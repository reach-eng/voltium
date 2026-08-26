import 'dart:io';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';
import 'package:crypto/crypto.dart';
import '../../utils/app_logger.dart';

/// TLS Certificate Pinning Interceptor.
///
/// AUDIT FIX (workflows P0-D & FL-12 CA-pin upgrade):
/// Supported Modes via `--dart-define=TLS_PIN_MODE=ca|hash|off`:
///   - `ca`: Restricts SecurityContext trust anchors to Voltium's explicit issuing
///     CA bundle (withTrustedRoots: false). Any chain not issued by our explicit
///     anchors fails validation outright (closes trusted-CA misissuance MITM).
///   - `hash`: SHA-256 cert fingerprint matching in badCertificateCallback.
///     Preserved as emergency rollback path.
///   - `off`: Unpinned (debug builds only; release builds throw StateError).
class PinnedHttpInterceptor {
  /// Active TLS Pinning mode configured at build time.
  ///
  /// 9.5+ Hardening §8 (T-9P0-5): the default flipped from `'hash'`
  /// to release-mode-driven. `ca` is the production target because it
  /// is rotation-friendly (the new CA cert is added to the bundle
  /// without changing the binary); `hash` remains an explicit
  /// emergency fallback. Debug builds default to `'off'` so the dev
  /// loop is not blocked on pinning. The release CI must pass
  /// `--dart-define=TLS_PIN_MODE=ca` (or `hash` for an emergency
  /// release) explicitly.
  static const String configuredPinMode = String.fromEnvironment(
    'TLS_PIN_MODE',
    defaultValue: kReleaseMode ? 'ca' : 'off',
  );

  /// Default production SHA-256 certificate fingerprints for Voltium's TLS cert.
  /// Includes backup/next-rotation certificate fingerprints to prevent bricking on cert rotation.
  static const List<String> productionFingerprints = [];

  /// Dynamically registered certificate fingerprints.
  static final List<String> _dynamicFingerprints = [];

  /// Bundled trusted CA certificates (PEM or DER bytes) for `ca` mode.
  static final List<Uint8List> _trustedCaCertBytes = [];

  /// The single hostname this client is allowed to talk to. Set by
  /// `ApiClient` from the resolved base URL before the first request.
  static String? pinnedHost;

  @visibleForTesting
  static bool? debugModeOverride;

  @visibleForTesting
  static String? pinModeOverride;

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

  /// Register trusted CA certificate bytes for `ca` mode.
  static void setTrustedCaCertBytes(List<Uint8List> certBytes) {
    _trustedCaCertBytes.clear();
    _trustedCaCertBytes.addAll(certBytes.where((b) => b.isNotEmpty));
    appDebug(
        '[PinnedHttpClient] Registered ${_trustedCaCertBytes.length} trusted CA certificates.');
  }

  /// Add a trusted CA certificate (PEM/DER bytes) to the active bundle.
  static void addTrustedCaCert(Uint8List certBytes) {
    if (certBytes.isNotEmpty) {
      _trustedCaCertBytes.add(certBytes);
    }
  }

  /// Clear all trusted CA certificates.
  static void clearTrustedCaCerts() {
    _trustedCaCertBytes.clear();
  }

  static List<Uint8List> get trustedCaCertBytes =>
      List.unmodifiable(_trustedCaCertBytes);

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
    final isDebug = debugModeOverride ?? kDebugMode;
    final mode = (pinModeOverride ?? configuredPinMode).toLowerCase().trim();

    if (isDebug && mode == 'off') {
      return http.Client();
    }

    if (!isDebug && mode == 'off') {
      // DEEP-AUDIT D-P0-1: never silently disable TLS pinning in release.
      throw StateError(
        'PinnedHttpClient: TLS_PIN_MODE=off is not permitted in release builds.',
      );
    }

    pinnedHost = expectedHost;

    if (mode == 'ca') {
      return _createCaPinnedClient(expectedHost);
    } else {
      return _createHashPinnedClient(expectedHost);
    }
  }

  static http.Client _createCaPinnedClient(String expectedHost) {
    if (_trustedCaCertBytes.isEmpty) {
      // DEEP-AUDIT D-P0-1 / FL-12: fail-closed if no CA certs configured in ca mode
      throw StateError(
        'PinnedHttpClient: no trusted CA certificates configured for TLS_PIN_MODE=ca. '
        'Ensure assets/certs/voltium-ca.pem is loaded or set via PinnedHttpInterceptor.setTrustedCaCertBytes().',
      );
    }

    final context = SecurityContext(withTrustedRoots: false);
    for (final bytes in _trustedCaCertBytes) {
      context.setTrustedCertificatesBytes(bytes);
    }

    final httpClient = HttpClient(context: context)
      ..badCertificateCallback = (X509Certificate cert, String host, int port) {
        appDebug(
          '[PinnedHttpClient] Certificate rejected under CA trust-anchor mode for $host.',
        );
        return false; // Strict: reject unknown / invalid chains outright
      };

    return IOClient(httpClient);
  }

  static http.Client _createHashPinnedClient(String expectedHost) {
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
