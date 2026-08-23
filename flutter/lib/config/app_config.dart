/// Environment-aware configuration.
///
/// Set FLAVOR at build time:
///   flutter run --dart-define=FLAVOR=dev        (local dev, default)
///   flutter run --dart-define=FLAVOR=staging     (staging server)
///   flutter run --dart-define=FLAVOR=production  (public release)
library;

import 'package:flutter/foundation.dart';
import 'package:universal_io/io.dart';

enum Flavor { dev, staging, production }

class AppConfig {
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

  static String get apiBaseUrl {
    switch (flavor) {
      case Flavor.production:
        return 'https://api.voltium.app';
      case Flavor.staging:
        return 'https://staging-api.voltium.app';
      case Flavor.dev:
        return 'http://10.0.2.2:8081';
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

  /// PR-7 (F-065 — 2026-08-22 deep audit): single source of truth
  /// for the local-dev host. Android emulators can't reach the
  /// host's `127.0.0.1` directly; the emulator routes the host
  /// machine through the magic IP `10.0.2.2`. iOS simulators and
  /// desktop runs use `127.0.0.1` directly. The previous code had
  /// three different places hardcoding one or the other
  /// (`api_client.dart`, `files_repository.dart`,
  /// `top_up_request_sent_card.dart`) — using the wrong one on the
  /// wrong platform silently 404'd. Always use this helper, never
  /// inline the literal.
  static String get localDevHost {
    if (!kIsWeb && Platform.isAndroid) return '10.0.2.2';
    return '127.0.0.1';
  }
}
