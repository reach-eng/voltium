import 'dart:convert';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';

/// Guarantor draft persistence.
///
/// AUDIT FIX (HIGH SECURITY): the guarantor draft carries PII (name, DOB,
/// phone, address, parents' names) plus phone-verification receipts. It used
/// to live in plaintext SharedPreferences via CacheService; it now mirrors
/// the KYC repository pattern (kyc_repository.dart F2 fix) and persists via
/// SecureStorageService (EncryptedSharedPreferences on Android / Keychain on
/// iOS), scoped to riderId. Legacy plaintext keys are migrated on first read
/// and cleaned up.
class GuarantorCache {
  static const _baseKey = 'guarantor_onboarding_form_cache';

  /// New encrypted-storage key namespace (mirrors kyc_repository).
  static String _getKey(String riderId) => 'guarantor_form:$riderId';

  /// @deprecated Legacy plaintext SharedPreferences key. Read once by
  /// [loadFormCache] to migrate any pre-migration draft into secure
  /// storage, then deleted. New writes never target this key.
  static String _legacyKey(String riderId) => '${_baseKey}_$riderId';

  /// AUDIT FIX (logout leak): pointer to the rider that owns the most
  /// recently written draft. Lets logout wipe the persisted draft without
  /// needing the (already-reset) rider state.
  static const _ownerPointerKey = 'guarantor_form:__owner';

  static Future<void> saveFormCache(
      String riderId, Map<String, dynamic> data) async {
    // Filter out nulls
    final cleanData = <String, dynamic>{};
    data.forEach((key, value) {
      if (value != null) {
        cleanData[key] = value;
      }
    });
    try {
      await SecureStorageService().writeValue(
        _getKey(riderId),
        jsonEncode(cleanData),
      );
      // Track the draft owner so logout can clear the draft even after the
      // rider state has been reset.
      await SecureStorageService().writeValue(_ownerPointerKey, riderId);
      // Clean up any legacy plaintext SharedPreferences cache.
      await CacheService().remove(_legacyKey(riderId));
    } catch (_) {
      // AUDIT FIX: cache write is best-effort (same as kyc_repository).
    }
  }

  static Future<Map<String, dynamic>?> loadFormCache(String riderId) async {
    final key = _getKey(riderId);
    final legacyKey = _legacyKey(riderId);
    try {
      // 1. Encrypted storage first.
      final secureRaw = await SecureStorageService().readValue(key);
      if (secureRaw != null && secureRaw.isNotEmpty) {
        return jsonDecode(secureRaw) as Map<String, dynamic>;
      }

      // 2. Migration fallback: legacy plaintext SharedPreferences draft is
      // promoted to secure storage and removed from prefs.
      final raw = CacheService().getString(legacyKey);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw) as Map<String, dynamic>;
        await SecureStorageService().writeValue(key, jsonEncode(decoded));
        await CacheService().remove(legacyKey);
        return decoded;
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  static Future<void> clearFormCache(String riderId) async {
    final key = _getKey(riderId);
    final legacyKey = _legacyKey(riderId);
    try {
      // Same pattern as kyc_repository.clearFormCache: overwrite the secure
      // entry with an empty string (loadFormCache treats empty as absent)
      // and drop the legacy plaintext key.
      await SecureStorageService().writeValue(key, '');
      await CacheService().remove(legacyKey);
      // If this rider owned the draft pointer, drop it too.
      final owner = await SecureStorageService().readValue(_ownerPointerKey);
      if (owner == riderId) {
        await SecureStorageService().writeValue(_ownerPointerKey, '');
      }
    } catch (_) {
      // Best-effort.
    }
  }

  /// AUDIT FIX (HIGH SECURITY, logout): clears the persisted guarantor draft
  /// belonging to whichever rider last wrote one, without needing the rider
  /// state (which is reset by the time logout cleanup runs). Used by
  /// RiderLogoutOrchestrator so the next rider on a shared device can never
  /// resume the previous rider's guarantor PII.
  static Future<void> clearCurrentDraft() async {
    try {
      final owner = await SecureStorageService().readValue(_ownerPointerKey);
      if (owner != null && owner.isNotEmpty) {
        await clearFormCache(owner);
      }
      await SecureStorageService().writeValue(_ownerPointerKey, '');
    } catch (_) {
      // Best-effort.
    }
  }
}
