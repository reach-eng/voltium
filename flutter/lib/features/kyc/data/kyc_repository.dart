import 'dart:io';
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart' as gen;
import 'package:voltium_rider/core/network/files_repository.dart';

class KycRepository {
  final VoltiumApiClient _apiClient;
  final FilesRepository _filesRepository;

  KycRepository(this._apiClient, this._filesRepository);

  Future<String> uploadDocument(File file, String documentType) {
    return _filesRepository.uploadFile(file, documentType);
  }

  Future<gen.KycStatusResponse> getKycStatus() {
    return _apiClient.getRiderKyc();
  }

  Future<gen.SubmitKycResponse> submitKyc(gen.SubmitKycRequest request) {
    return _apiClient.postRiderKyc(request);
  }

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
    await _apiClient.putRiderProfile(gen.UpdateProfileRequest(
      fullName: name,
      email: email,
      currentAddress: address,
      dob: dob,
      fatherName: fatherName,
      motherName: motherName,
      aadhaarFront: aadhaarFrontUrl,
      aadhaarBack: aadhaarBackUrl,
      panCard: panUrl,
      selfie: selfieUrl,
      signature: signatureUrl,
      bankName: bankName,
      bankAccount: accountNumber,
      bankIfsc: ifscCode,
    ));
  }

  static Future<void> saveFormCache(Map<String, dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('kyc_form_cache', jsonEncode(data));
  }

  static Future<Map<String, dynamic>?> loadFormCache() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString('kyc_form_cache');
    if (raw == null || raw.isEmpty) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  static Future<void> clearFormCache() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('kyc_form_cache');
  }
}
