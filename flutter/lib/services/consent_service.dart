import 'package:flutter/foundation.dart';

import '../core/network/api_client.dart';
import 'secure_storage_service.dart';

enum ConsentType {
  location('LOCATION'),
  contacts('CONTACTS'),
  callLogs('CALL_LOGS');

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
      debugPrint('ConsentService: failed to sync consent: $e');
    }
  }
}
