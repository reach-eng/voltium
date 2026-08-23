import 'dart:convert';

import 'package:crypto/crypto.dart';

import '../utils/app_logger.dart';
import '../core/observability/posthog_service.dart';

/// Canonical telemetry interface for the rider app.
///
/// PR-11 (2026-08-21): `monitoring_service.dart` is the SINGLE entry
/// point Flutter code should call for telemetry. It owns:
///
/// - local debug logging (always on, PII-masked)
/// - structured event capture (PII-scrubbed, forwarded to PostHog)
/// - screen-view capture
/// - user identity management (forwarded to PostHog)
/// - error logging (local only — PostHog also catches its own
///   errors at the SDK boundary, no need to double up)
///
/// Why this layer exists: PostHog is a vendor-specific SDK. Calling
/// it directly from screens and providers spreads SDK awareness
/// across the codebase and makes it hard to swap telemetry backends
/// or add a second sink later. `MonitoringService` is a thin facade
/// that hides the PostHog-specific surface (and the package import)
/// from feature code.
///
/// Rules for callers:
/// - Flutter code MUST call [MonitoringService] for events, screens,
///   identity, and error logging.
/// - Flutter code MUST NOT import `package:posthog_flutter/...`
///   directly. (Lint in `analysis_options.yaml` will flag this.)
/// - The 50+ existing direct `PostHogService.capture(...)` call sites
///   in feature screens are tolerated for now and will be migrated
///   to `MonitoringService.logEvent(...)` in a follow-up; this PR
///   consolidates the *layer* (where AnalyticsService sits), not
///   every call site.
///
/// See `flutter/docs/TELEMETRY.md` for the full architecture map.
class MonitoringService {
  static Future<void> initialize() async {
    // PR-11 (2026-08-21): initializing PostHog is the SDK wrapper's
    // job, but we kick it off from here so the canonical interface
    // owns the boot order. main() awaits MonitoringService.initialize()
    // and then runs the app; if PostHog init fails we want a single
    // visible log line, not a stack trace.
    await PostHogService.initialize();
    appDebug('ℹ️ [Monitoring] Local-only monitoring initialized');
  }

  /// Log an error. Local-only; PostHog also catches its own errors
  /// at the SDK boundary (the Posthog().capture(...) call in
  /// posthog_service.dart routes through `_scrubProperties`).
  static void logError(dynamic error, dynamic stackTrace, {String? reason}) {
    final maskedError = _maskPII(error.toString());
    final maskedReason = reason == null ? '' : ' reason=${_maskPII(reason)}';
    appDebug(
      '🚨 [Monitoring] Error logged locally: $maskedError$maskedReason',
    );
    if (stackTrace != null) {
      appDebug(stackTrace.toString());
    }
  }

  static void logInfo(String message) {
    appDebug('ℹ️ [Monitoring] Info: ${_maskPII(message)}');
  }

  /// Capture a structured event. Forwarded to PostHog (which applies
  /// its own PII scrubbing on property keys) and also emitted to the
  /// local log (which masks PII in *values*).
  static Future<void> logEvent(
    String name, {
    Map<String, dynamic>? parameters,
  }) async {
    final safeParams = parameters
        ?.map((key, value) => MapEntry(key, _maskPII(value.toString())));
    appDebug('ℹ️ [Monitoring] Event: ${_maskPII(name)} ${safeParams ?? ''}');
    // Forward to PostHog with the ORIGINAL (unmasked) values;
    // PostHogService.capture is the PII-scrubbing boundary and
    // will redact property keys named phone/email/otp/etc.
    final properties = parameters?.map(
      (k, v) => MapEntry(k, v as Object),
    );
    await PostHogService.capture(name, properties: properties);
  }

  /// Capture a screen view. Equivalent to `logEvent('$screenName viewed')`
  /// but routes through PostHog's `screen()` API so PostHog's
  /// dashboard can break down engagement by screen.
  static Future<void> logScreen(
    String screenName, {
    Map<String, dynamic>? parameters,
  }) async {
    appDebug('ℹ️ [Monitoring] Screen: ${_maskPII(screenName)}');
    final properties = parameters?.map(
      (k, v) => MapEntry(k, v as Object),
    );
    await PostHogService.screen(screenName, properties: properties);
  }

  /// Identify the current user. Forwarded to PostHog with a
  /// SHA-256-hashed riderId so the PostHog dashboard can join events
  /// across sessions for the same rider without storing the raw
  /// identifier.
  ///
  /// PR-8 (F-053 — 2026-08-22 deep audit): the previous
  /// implementation used Dart's `String.hashCode`, which is a 32-bit
  /// int on the web (and a 64-bit int on the VM). A 32-bit hash has
  /// ~4.3B buckets — at 1M MAU a rider has a 12% chance of
  /// collision; the PostHog dashboard would then group two
  /// unrelated riders' events. SHA-256 is 64 hex chars (256 bits)
  /// so the collision probability is effectively zero.
  static Future<void> identifyUser(
    String userId, {
    Map<String, dynamic>? properties,
  }) async {
    final hashed = sha256.convert(utf8.encode(userId)).toString();
    final safeProps = properties?.map(
      (k, v) => MapEntry(k, v as Object),
    );
    appDebug('ℹ️ [Monitoring] Identify: hash=$hashed');
    await PostHogService.identify(hashed, properties: safeProps);
  }

  /// Clear the current user identity. Called on logout.
  static Future<void> resetUser() async {
    appDebug('ℹ️ [Monitoring] User reset');
    await PostHogService.reset();
  }

  static String _maskPII(String text) {
    return text.replaceAllMapped(RegExp(r'(\+91\s?)?(\d{6})(\d{4})'), (match) {
      final prefix = match.group(1) ?? '';
      final last4 = match.group(3);
      return '$prefix******$last4';
    }).replaceAll(
      RegExp(r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', caseSensitive: false),
      '***@***',
    );
  }
}
