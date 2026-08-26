// 9.5+ Hardening §8.4 (T-9P0-5): the TLS CA loader.
//
// Why this exists:
//   In `ca` mode, `PinnedHttpInterceptor` requires
//   `setTrustedCaCertBytes(...)` to be called BEFORE the first
//   `createClient()` invocation. The CA bytes are bundled in
//   `flutter/assets/certs/voltium-ca.pem` and must be loaded through
//   `rootBundle` (a Flutter framework call that needs
//   `WidgetsFlutterBinding.ensureInitialized()` to have run).
//
//   The previous bootstrap order was `main() -> runApp(VoltiumApp())`
//   with no chance to load the CA before the singleton `ApiClient`
//   first constructs. Result: a release build with `TLS_PIN_MODE=ca`
//   would throw `StateError: no trusted CA certificates configured`
//   on the first network call.
//
// How to use it:
//   ```dart
//   Future<void> main() async {
//     WidgetsFlutterBinding.ensureInitialized();
//     await TlsPinsLoader.loadBundledCa();
//     runApp(const VoltiumApp());
//   }
//   ```
//
//   `loadBundledCa()` is a no-op when `TLS_PIN_MODE` is not `ca`, so
//   debug builds with `off` and emergency release builds with `hash`
//   both pass through untouched.
import 'package:flutter/services.dart';

import 'pinned_http_client.dart';

/// Default location of the production TLS trust anchor inside the
/// Flutter asset bundle. The file MUST exist for `ca` mode to
/// construct an HTTP client.
const String _kBundledCaAssetPath = 'assets/certs/voltium-ca.pem';

class TlsPinsLoader {
  /// Load the production CA bundle from `assets/certs/voltium-ca.pem`
  /// and register it with `PinnedHttpInterceptor`.
  ///
  /// - Returns `true` when CA bytes were loaded and registered.
  /// - Returns `false` when `TLS_PIN_MODE != 'ca'` (no-op).
  /// - Throws [StateError] when `TLS_PIN_MODE == 'ca'` but the asset
  ///   is missing or empty — this is the same fail-closed contract
  ///   `PinnedHttpInterceptor._createCaPinnedClient` enforces, just
  ///   surfaced earlier (at bootstrap, not at first request).
  static Future<bool> loadBundledCa({
    String assetPath = _kBundledCaAssetPath,
  }) async {
    final mode = PinnedHttpInterceptor.configuredPinMode.toLowerCase().trim();
    if (mode != 'ca') return false;

    final ByteData data = await rootBundle.load(assetPath);
    final Uint8List bytes = data.buffer.asUint8List(
      data.offsetInBytes,
      data.lengthInBytes,
    );
    if (bytes.isEmpty) {
      throw StateError(
        'TlsPinsLoader: bundled CA asset `$assetPath` is empty. '
        'Replace it via the runbook in docs/RUNBOOK_TLS_ROTATION.md '
        '(plan section 8.7).',
      );
    }
    PinnedHttpInterceptor.setTrustedCaCertBytes([bytes]);
    return true;
  }
}
