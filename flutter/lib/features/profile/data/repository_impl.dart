import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/profile/domain/repository.dart';

/// Implementation of [RiderRepository] using the Voltium API.
class RiderRepositoryImpl implements RiderRepository {
  final ApiClient _client;
  final VoltiumApiClient _apiClient;

  RiderRepositoryImpl(this._client, this._apiClient);

  @override
  Future<Map<String, dynamic>> getRiderProfile() async {
    final response = await _apiClient.getRiderProfile();
    return {
      'data': response.toJson(),
      'rider': response.toJson(),
    };
  }

  @override
  Future<void> updateRiderProfile(Map<String, dynamic> data) async {
    final request = UpdateProfileRequest(
      fullName: data['fullName'] as String?,
      email: data['email'] as String?,
      fatherName: data['fatherName'] as String?,
      motherName: data['motherName'] as String?,
      currentAddress: data['currentAddress'] as String?,
      emergencyContact: data['emergencyContact'] as String?,
      dob: data['dob'] as String?,
      intent: data['intent'] as String?,
      aadhaarFront: data['aadhaarFront'] as String?,
      aadhaarBack: data['aadhaarBack'] as String?,
      panCard: data['panCard'] as String?,
    );
    await _apiClient.putRiderProfile(request);
  }

  @override
  Future<void> registerFCMToken(String token) async {
    await _apiClient.postRidersRegisterToken({'token': token});
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
