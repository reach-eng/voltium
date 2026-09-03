/// Environment-aware configuration.
///
/// Set FLAVOR at build time:
///   flutter run --dart-define=FLAVOR=dev        (local dev, default)
///   flutter run --dart-define=FLAVOR=staging     (staging server)
///   flutter run --dart-define=FLAVOR=production  (public release)
library;

import 'package:flutter/foundation.dart';
import 'package:voltium_rider/core/platform/platform_info.dart';

enum Flavor { dev, staging, production }

class AppConfig {
  AppConfig._();

  static Flavor get flavor {
    const flavorStr = String.fromEnvironment('FLAVOR', defaultValue: 'dev');
    switch (flavorStr) {
      case 'production':
        return Flavor.production;
      case 'staging':
        return Flavor.staging;
      default:
        return Flavor.dev;
    }
  }

  static const configuredApiUrl = String.fromEnvironment('API_URL');

  static String get apiBaseUrl {
    if (configuredApiUrl.isNotEmpty) return configuredApiUrl;
    if (PlatformInfo.isWeb) return '';
    switch (flavor) {
      case Flavor.production:
        return 'https://api.voltium.app';
      case Flavor.staging:
        return 'https://staging-api.voltium.app';
      case Flavor.dev:
        return PlatformInfo.isAndroid
            ? 'http://10.0.2.2:8081'
            : 'http://127.0.0.1:8081';
    }
  }

  static String get appName {
    switch (flavor) {
      case Flavor.production:
        return 'Voltium';
      case Flavor.staging:
        return 'Voltium Staging';
      case Flavor.dev:
        return 'Voltium Dev';
    }
  }

  static String get firebaseProjectId {
    switch (flavor) {
      case Flavor.production:
        return 'voltium-prod';
      case Flavor.staging:
        return 'voltium-staging';
      case Flavor.dev:
        return 'voltium-dev';
    }
  }

  static bool get isTestOrDev => flavor == Flavor.dev || kDebugMode;

  // ── Support contact ──────────────────────────────────────────────────
  /// Support email shown to the rider in the legal page, the FAQ screen,
  /// and the support centre. Single source of truth.
  static const String supportEmail = 'support@voltium.app';

  /// Support phone shown to the rider in the same three surfaces. Use the
  /// unformatted E.164 string when building `tel:` / `mailto:` URIs.
  static const String supportPhone = '+91 1800-889-VOLT';
  static const String supportPhoneCompact = '+9118008898658';

  // ── Legal / policy ───────────────────────────────────────────────────
  /// The current legal document version. Increment when any of the 5 inlined
  /// legal documents in `legal_page_content.dart` change so existing riders
  /// are prompted to re-consent.
  static const String legalVersion = 'public-beta-v1';
}
