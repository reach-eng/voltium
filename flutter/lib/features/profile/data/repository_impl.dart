import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import '../domain/repository.dart';

class RiderRepositoryImpl implements RiderRepository {
  final ApiClient _client;
  final VoltiumApiClient _apiClient;

  RiderRepositoryImpl(this._client, this._apiClient);

  @override
  Future<Map<String, dynamic>> getRiderProfile() async {
    final response = await _apiClient.getRiderProfile();
    return response.toJson();
  }

  @override
  Future<void> updateRiderProfile(Map<String, dynamic> data) async {
    final request = UpdateProfileRequest.fromJson(data);
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
    return _apiClient.getRiderEarnings();
  }

  @override
  Future<Map<String, dynamic>> getSettings() async {
    return _apiClient.getRiderSettings();
  }

  @override
  Future<Map<String, dynamic>> getDeviceDetails() async {
    return _apiClient.postRiderDevice({});
  }
}
