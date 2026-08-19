import 'dart:convert';

import 'package:universal_io/io.dart';

import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';

/// Repository for KYC operations, document uploads, and profile updates.
class KycRepository {
  final VoltiumApiClient _apiClient;
  final FilesRepository _filesRepository;

  KycRepository(this._apiClient, this._filesRepository);

  /// Upload a KYC document file with typed category.
  Future<String> uploadDocument(File file, dynamic category) async {
    return _filesRepository.uploadFile(file, category);
  }

  /// Update rider profile with KYC data.
  Future<void> updateProfile({
    required String riderId,
    required String name,
    required String email,
    required String address,
    required String dob,
    required String fatherName,
    required String motherName,
    required String bankName,
    required String accountNumber,
    required String ifscCode,
    required String aadhaarFrontUrl,
    required String aadhaarBackUrl,
    required String panUrl,
    required String selfieUrl,
    required String signatureUrl,
  }) async {
    await _apiClient.putRiderProfile(UpdateProfileRequest(
      fullName: name,
      email: email,
      currentAddress: address,
      dob: dob,
      fatherName: fatherName,
      motherName: motherName,
      bankName: bankName,
      bankAccount: accountNumber,
      bankIfsc: ifscCode,
      aadhaarFront: aadhaarFrontUrl,
      aadhaarBack: aadhaarBackUrl,
      panCard: panUrl,
      profilePhoto: selfieUrl,
      signature: signatureUrl,
    ));
  }

  // ── Form cache helpers ─────────────────────────────────────────────────
  //
  // SECURITY (F2 fix): Financial PII (bankAccount, bankIfsc) is stripped from
  // persistent storage. The remaining draft fields are persisted securely via
  // `SecureStorageService` (EncryptedSharedPreferences on Android / Keychain on iOS)
  // scoped to `riderId`. Legacy plain SharedPreferences keys are cleaned up on access.

  static String _cacheKey(String riderId) => 'kyc_form:$riderId';

  static Future<void> saveFormCache({
    required String riderId,
    required Map<String, String?> data,
  }) async {
    final entry = <String, String>{};
    data.forEach((k, v) {
      // Exclude financial PII from persistent storage
      if (v != null && k != 'bankAccount' && k != 'bankIfsc') {
        entry[k] = v;
      }
    });

    try {
      await SecureStorageService().writeValue(
        _cacheKey(riderId),
        jsonEncode(entry),
      );
      // Clean up any legacy plaintext SharedPreferences cache
      await CacheService().remove(_cacheKey(riderId));
    } catch (_) {
      // Cache write is best-effort.
    }
  }

  static Future<Map<String, String>?> loadFormCache({
    required String riderId,
  }) async {
    final key = _cacheKey(riderId);
    try {
      // 1. Check SecureStorage first
      final secureRaw = await SecureStorageService().readValue(key);
      if (secureRaw != null && secureRaw.isNotEmpty) {
        final decoded = jsonDecode(secureRaw);
        if (decoded is Map) {
          return decoded.map((k, v) => MapEntry(k.toString(), v.toString()));
        }
      }

      // 2. Migration fallback: check legacy SharedPreferences
      final raw = CacheService().getString(key);
      if (raw != null && raw.isNotEmpty) {
        final decoded = jsonDecode(raw);
        if (decoded is Map) {
          final result =
              decoded.map((k, v) => MapEntry(k.toString(), v.toString()));
          // Migrate to SecureStorage and clean up plaintext prefs
          await SecureStorageService().writeValue(key, jsonEncode(result));
          await CacheService().remove(key);
          return result;
        }
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  static Future<void> clearFormCache({required String riderId}) async {
    final key = _cacheKey(riderId);
    try {
      await SecureStorageService().writeValue(key, '');
      await CacheService().remove(key);
    } catch (_) {
      // Best-effort.
    }
  }
}
