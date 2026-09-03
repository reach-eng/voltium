import 'dart:convert';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';

/// Persisted cache for the guarantor onboarding draft.
///
/// F-39: The guarantor form contains sensitive PII (Aadhaar, PAN, phone,
/// personal relationships, address, and consent artifacts). It is stored
/// in hardware-backed encrypted storage via [EncryptedCacheService] /
/// [FlutterSecureStorage] rather than plaintext SharedPreferences.
class GuarantorCache {
  static const _baseKey = 'guarantor_onboarding_form_cache';

  static String _getKey(String riderId) => '${_baseKey}_$riderId';

  static Future<void> saveFormCache(
      String riderId, Map<String, dynamic> data) async {
    // Filter out nulls
    final cleanData = <String, dynamic>{};
    data.forEach((key, value) {
      if (value != null) {
        cleanData[key] = value;
      }
    });

    // Write to encrypted secure storage
    await EncryptedCacheService().write(_getKey(riderId), cleanData);

    // Clean up any legacy plaintext SharedPreferences cache
    await CacheService().remove(_getKey(riderId));
  }

  static Future<Map<String, dynamic>?> loadFormCache(String riderId) async {
    final key = _getKey(riderId);
    try {
      // 1. Primary: load from encrypted storage
      final secureData = await EncryptedCacheService().read(key);
      if (secureData != null && secureData.isNotEmpty) {
        return secureData;
      }

      // 2. Migration fallback: load from legacy plaintext cache
      final cachedStr = CacheService().getString(key);
      if (cachedStr != null && cachedStr.isNotEmpty) {
        try {
          final decoded = jsonDecode(cachedStr);
          if (decoded is Map) {
            final mapped = Map<String, dynamic>.from(decoded);
            // Migrate to encrypted storage and clean up plaintext
            await EncryptedCacheService().write(key, mapped);
            await CacheService().remove(key);
            return mapped;
          }
        } catch (_) {}
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  static Future<void> clearFormCache(String riderId) async {
    final key = _getKey(riderId);
    await EncryptedCacheService().delete(key);
    await CacheService().remove(key);
  }

  static Future<void> clearCurrentDraft([String? riderId]) async {
    if (riderId != null && riderId.isNotEmpty) {
      await clearFormCache(riderId);
    } else {
      await CacheService().invalidatePattern(_baseKey);
      try {
        final currentRiderId = await SecureStorageService().getRiderId();
        if (currentRiderId != null && currentRiderId.isNotEmpty) {
          await clearFormCache(currentRiderId);
        }
      } catch (_) {}
    }
  }
}
