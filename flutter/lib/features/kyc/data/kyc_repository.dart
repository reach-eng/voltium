import 'package:universal_io/io.dart';

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
      selfie: selfieUrl,
      signature: signatureUrl,
    ));
  }

  // ── Form cache helpers ─────────────────────────────────────────────────
  //
  // SECURITY: The cache is keyed by riderId. Without this scoping, a
  // second user on a shared device would see the first user's Aadhaar
  // number and bank details when they open the KYC form. The previous
  // implementation used a static Map<String, String>? that was process-
  // wide and unscoped, which leaked PII between users on the same
  // device. See Bug 21 in the user experience test report.

  static final Map<String, Map<String, String>> _cacheByRider = {};

  static String _cacheKey(String riderId) => 'kyc_form:$riderId';

  static Future<void> saveFormCache({
    required String riderId,
    required Map<String, String?> data,
  }) async {
    final key = _cacheKey(riderId);
    final entry = <String, String>{};
    data.forEach((k, v) {
      if (v != null) entry[k] = v;
    });
    _cacheByRider[key] = entry;
  }

  static Future<Map<String, String>?> loadFormCache({
    required String riderId,
  }) async {
    final entry = _cacheByRider[_cacheKey(riderId)];
    return entry == null ? null : Map<String, String>.from(entry);
  }

  static Future<void> clearFormCache({required String riderId}) async {
    _cacheByRider.remove(_cacheKey(riderId));
  }
}
