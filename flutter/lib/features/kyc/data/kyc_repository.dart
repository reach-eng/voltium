import 'dart:io';

import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';

/// Repository for KYC operations, document uploads, and profile updates.
class KycRepository {
  final VoltiumApiClient _apiClient;
  final FilesRepository _filesRepository;

  KycRepository(this._apiClient, this._filesRepository);

  /// Upload a KYC document file.
  Future<String> uploadDocument(File file, String type) async {
    return _filesRepository.uploadFile(file, type);
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
    ));
  }

  // ── Static form cache helpers ──────────────────────────────────────────

  static Future<void> saveFormCache(Map<String, String?> data) async {
    _cache = Map<String, String>.from(data);
  }

  static Future<Map<String, String>?> loadFormCache() async {
    return _cache != null ? Map<String, String>.from(_cache!) : null;
  }

  static Future<void> clearFormCache() async {
    _cache = null;
  }

  static Map<String, String>? _cache;
}
