import '../core/network/api_client.dart';
import 'secure_storage_service.dart';
import '../utils/app_logger.dart';

/// Consent types the rider can grant. PR-VER-2026-08-07 (FLUTTER_CONSENT
/// P1-1): expanded to cover every permission the onboarding screen requests
/// (previously only location/contacts/call-logs synced — the other six were
/// local-only). Values must match the backend consentSchema enum in
/// web/src/lib/validators.ts.
///
/// LEGAL-AUDIT-P0-1-2026-09-08: extended with the six LEGAL_CONSENT_TYPES
/// (TERMS, PRIVACY, RENTAL_SAFETY, REFUND, GUARANTOR, LEASE). The server
/// side (web/src/app/api/rider/consent/route.ts) marks these as
/// `source: 'SERVER'` (i.e. the acceptance was against server-rendered
/// content, not a device permission). The Flutter side just sends them
/// like any other consent; the server decides the source based on the
/// LEGAL_CONSENT_TYPES set.
enum ConsentType {
  // Device consent types (existing).
  location('LOCATION'),
  contacts('CONTACTS'),
  callLogs('CALL_LOGS'),
  camera('CAMERA'),
  phone('PHONE'),
  mic('MIC'),
  battery('BATTERY'),
  notifications('NOTIFICATIONS'),
  deviceAdmin('DEVICE_ADMIN'),
  // Legal acceptance types (LEGAL-AUDIT-P0-1-2026-09-08).
  terms('TERMS'),
  privacy('PRIVACY'),
  rentalSafety('RENTAL_SAFETY'),
  refund('REFUND'),
  guarantor('GUARANTOR'),
  lease('LEASE');

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
      await _client.post(
        '/api/rider/consent',
        body: {
          'consentType': type.apiValue,
          'granted': granted,
          'policyVersion': policyVersion,
        },
      );
    } catch (e) {
      appDebug('ConsentService: failed to sync consent: $e');
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
