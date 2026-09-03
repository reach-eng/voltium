import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../../utils/app_logger.dart';
import 'pinned_http_client_io.dart'
    if (dart.library.html) 'pinned_http_client_web.dart' as platform;

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
    // Flutter web has no `dart:io` HttpClient — the `/rider-app` release-web
    // embed would otherwise crash on import. Web TLS is terminated by the
    // browser (same-origin `/rider-app`); pinning is a no-op there.
    if (kIsWeb) return http.Client();
    if (kDebugMode) {
      return http.Client();
    }

    final activeFingerprints = configuredFingerprints;
    if (activeFingerprints.isEmpty) {
      // DEEP-AUDIT D-P0-1: never silently disable TLS pinning in release.
      // A build that ships without a fingerprint set is a security incident
      // waiting to happen (MITM via rogue CA / fraudulent proxy). The
      // pre-fix behavior of falling back to a plain http.Client with only
      // a debug log let misconfigured release builds ship unprotected with
      // zero signal to the operator. Throw loudly so the app crashes on
      // first network call rather than running with no pinning.
      throw StateError(
        'PinnedHttpClient: no production TLS fingerprints configured. '
        'Build the release with --dart-define=TLS_PIN_SHA256="<hash1>,<hash2>" '
        'or set DynamicPins via PinnedHttpInterceptor.setDynamicPins() at '
        'app start. See pinned_http_client.dart for the deployment checklist.',
      );
    }

    return platform.createPinnedClient(activeFingerprints);
  }
}
