import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/profile/domain/repository.dart';
import '../../../utils/app_logger.dart';

/// Implementation of [RiderRepository] using the Voltium API.
class RiderRepositoryImpl implements RiderRepository {
  final ApiClient _client;
  final VoltiumApiClient _apiClient;

  RiderRepositoryImpl(this._client, this._apiClient);

  @override
  Future<Map<String, dynamic>> getRiderProfile() async {
    try {
      final response = await _apiClient.getRiderProfile();
      return {
        'success': true,
        'data': response.toJson(),
        'rider': response.toJson(),
      };
    } catch (e) {
      appDebug('GET_RIDER_PROFILE_ERROR: $e');
      rethrow;
    }
  }

  @override
  Future<void> updateRiderProfile(Map<String, dynamic> data) async {
    // PR-VER-2026-08-07 (PROFILE P0-6): previously only ~11 of the supported
    // fields were mapped — the rest of the profile (KYC documents, guarantor,
    // permission grants, vehicle-return payload) was silently dropped. Pass
    // through the full generated-model surface; the server enforces its own
    // field allowlist on the other side.
    final request = UpdateProfileRequest(
      riderId: data['riderId'] as String?,
      fullName: data['fullName'] as String?,
      email: data['email'],
      fatherName: data['fatherName'] as String?,
      motherName: data['motherName'] as String?,
      currentAddress: data['currentAddress'] as String?,
      emergencyContact: data['emergencyContact'] as String?,
      dob: data['dob'] as String?,
      intent: data['intent'] as String?,
      profilePhoto: data['profilePhoto'],
      riderPhoto: data['riderPhoto'],
      signature: data['signature'],
      aadhaarFront: data['aadhaarFront'],
      aadhaarBack: data['aadhaarBack'],
      panCard: data['panCard'],
      bankName: data['bankName'],
      bankAccount: data['bankAccount'],
      bankIfsc: data['bankIfsc'],
      selfie: data['selfie'],
      returnPending: data['returnPending'] as bool?,
      returnPhotos: (data['returnPhotos'] as List?)?.cast<String>(),
      returnReason: data['returnReason'] as String?,
      latitude: (data['latitude'] as num?)?.toDouble(),
      longitude: (data['longitude'] as num?)?.toDouble(),
      guarantorName: data['guarantorName'] as String?,
      guarantorPhone: data['guarantorPhone'] as String?,
      guarantorRelation: data['guarantorRelation'] as String?,
      guarantorDob: data['guarantorDob'] as String?,
      guarantorFatherName: data['guarantorFatherName'] as String?,
      guarantorMotherName: data['guarantorMotherName'] as String?,
      guarantorAddress: data['guarantorAddress'] as String?,
      guarantorAadhaarFront: data['guarantorAadhaarFront'] as String?,
      guarantorAadhaarBack: data['guarantorAadhaarBack'] as String?,
      guarantorPan: data['guarantorPan'] as String?,
      guarantorVideo: data['guarantorVideo'] as String?,
      guarantorSignature: data['guarantorSignature'] as String?,
      guarantorPhoto: data['guarantorPhoto'] as String?,
      guarantorStatus: data['guarantorStatus'] as String?,
      locationGranted: data['locationGranted'] as bool?,
      batteryGranted: data['batteryGranted'] as bool?,
      contactsGranted: data['contactsGranted'] as bool?,
      callLogsGranted: data['callLogsGranted'] as bool?,
      micGranted: data['micGranted'] as bool?,
      cameraGranted: data['cameraGranted'] as bool?,
      phoneGranted: data['phoneGranted'] as bool?,
    );
    await _apiClient.putRiderProfile(request);
  }

  @override
  Future<void> registerFCMToken(String fcmToken) async {
    // Body must match `registerTokenSchema` in web/src/lib/validators.ts
    // (BLOCKER 1.2): the server derives the riderId from the verified
    // session, not from this body, so we send only fcmToken.
    await _apiClient.postRidersRegisterToken({'fcmToken': fcmToken});
  }

  @override
  Future<void> syncDeviceData(Map<String, dynamic> data) async {
    await _apiClient.postRiderSyncDeviceData(data);
  }

  @override
  Future<Map<String, dynamic>> getEarnings() async {
    return await _apiClient.getRiderEarnings();
  }

  @override
  Future<Map<String, dynamic>> getSettings() async {
    return await _apiClient.getRiderSettings();
  }

  @override
  Future<Map<String, dynamic>> getDeviceDetails() async {
    final response = await _client.get('/api/rider/device');
    return response;
  }
}
