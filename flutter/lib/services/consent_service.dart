import '../core/network/api_client.dart';
import 'secure_storage_service.dart';
import 'monitoring_service.dart';
import '../utils/app_logger.dart';

/// Consent types the rider can grant. PR-VER-2026-08-07 (FLUTTER_CONSENT
/// P1-1): expanded to cover every permission the onboarding screen requests
/// (previously only location/contacts/call-logs synced — the other six were
/// local-only). Values must match the backend consentSchema enum in
/// web/src/lib/validators.ts.
enum ConsentType {
  location('LOCATION'),
  contacts('CONTACTS'),
  callLogs('CALL_LOGS'),
  camera('CAMERA'),
  phone('PHONE'),
  mic('MIC'),
  battery('BATTERY'),
  notifications('NOTIFICATIONS'),
  deviceAdmin('DEVICE_ADMIN');

  const ConsentType(this.apiValue);
  final String apiValue;
}

class ConsentService {
  static final ConsentService _instance = ConsentService._internal();
  factory ConsentService() => _instance;
  ConsentService._internal();

  final SecureStorageService _storage = SecureStorageService();
  final ApiClient _client = ApiClient();

  String _key(ConsentType type) => 'consent_${type.apiValue.toLowerCase()}';

  Future<bool> hasConsent(ConsentType type) async {
    return await _storage.readValue(_key(type)) == 'true';
  }

  Future<void> setConsent(
    ConsentType type, {
    required bool granted,
    String policyVersion = 'public-beta-v1',
  }) async {
    await _storage.writeValue(_key(type), granted ? 'true' : 'false');

    try {
      // PR-8 (F-059 — 2026-08-22 deep audit): the consent POST
      // is idempotent-by-key. Without `Idempotency-Key`, a
      // network failure between the local write and the server
      // ack triggers `syncAllConsents` on next launch, which
      // would re-POST the same consent — the server's
      // deduplication is then undefined behavior. A per-call
      // key (the consent type + a fresh UUID) makes the
      // network call safely retryable: a 504 returns
      // `idempotent: true` on the second attempt and the
      // server stays in sync.
      await _client.post(
        '/api/rider/consent',
        body: {
          'consentType': type.apiValue,
          'granted': granted,
          'policyVersion': policyVersion,
        },
        idempotencyKey: ApiClient.newIdempotencyKey(),
      );
    } catch (e, stack) {
      appDebug('ConsentService: failed to sync consent: $e');
      // PR-8 (F-059): log the failure so a server-side outage
      // during a permission grant is visible. The local
      // write is durable; `syncAllConsents` will retry on
      // next launch. Without this log, a rider with the
      // "permissions" tile stuck at "pending sync" had no
      // observability path.
      MonitoringService.logError(e, stack,
          reason: 'ConsentService: consent sync POST failed');
    }
  }

  /// Sync all stored consent values to the backend.
  /// Called after app launch or when the backend may have missed a sync.
  Future<void> syncAllConsents(
      {String policyVersion = 'public-beta-v1'}) async {
    for (final type in ConsentType.values) {
      try {
        final storedValue = await _storage.readValue(_key(type));
        if (storedValue != null) {
          final granted = storedValue == 'true';
          await _client.post(
            '/api/rider/consent',
            body: {
              'consentType': type.apiValue,
              'granted': granted,
              'policyVersion': policyVersion,
            },
          );
        }
      } catch (e) {
        appDebug(
            'ConsentService: failed to sync consent for ${type.apiValue}: $e');
      }
    }
  }
}
