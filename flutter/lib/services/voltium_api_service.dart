import 'package:universal_io/io.dart';
import 'package:flutter/foundation.dart';
import '../core/network/api_client.dart';
import '../core/network/generated/api_client.dart';
import '../core/network/generated/api_models.dart' as gen;
import '../core/network/files_repository.dart';

/// Generated-client backed service facade for rider app workflows.
///
/// All calls are routed through the generated [VoltiumApiClient] and repositories.
class VoltiumApiService {
  final ApiClient _client;
  final VoltiumApiClient _apiClient;
  final FilesRepository _filesRepository;

  static VoltiumApiService? _instance;

  factory VoltiumApiService() {
    _instance ??= VoltiumApiService.withClient(ApiClient());
    return _instance!;
  }

  /// Override the singleton instance for testing only.
  /// Do not use in production code (F-025).
  @visibleForTesting
  static set instance(VoltiumApiService? val) => _instance = val;

  VoltiumApiService.withClient(ApiClient client)
      : _client = client,
        _apiClient = VoltiumApiClient(client),
        _filesRepository = FilesRepository(client, VoltiumApiClient(client));

  Future<Map<String, dynamic>> sendOtp({
    required String phone,
    String? referralCode,
  }) async {
    final response = await _apiClient.postAuthSendOtp(
      gen.SendOtpRequest(
        phone: phone,
      ),
    );
    return response.toJson();
  }

  Future<Map<String, dynamic>> verifyOtp({
    required String phone,
    required String otp,
  }) async {
    final response = await _apiClient.postAuthVerifyOtp(
      gen.VerifyOtpRequest(
        phone: phone,
        otp: otp,
      ),
    );
    return response.toJson();
  }

  Future<Map<String, dynamic>> verifyPhone({
    required String phone,
    required String otp,
  }) async {
    final response = await _apiClient.postAuthVerifyPhone(
      gen.VerifyPhoneRequest(
        phone: phone,
        otp: otp,
      ),
    );
    return response.toJson();
  }

  Future<Map<String, dynamic>> fetchRiderProfile({
    String? riderId,
    String? phone,
  }) async {
    final response = await _apiClient.getRiderProfile();
    return response.toJson();
  }

  Future<Map<String, dynamic>> updateProfile({
    required String riderId,
    required Map<String, dynamic> data,
  }) async {
    final response = await _apiClient
        .putRiderProfile(gen.UpdateProfileRequest.fromJson(data));
    return response;
  }

  Future<String> uploadFile(File file, String type) async {
    return _filesRepository.uploadFile(file, type);
  }

  Future<Map<String, dynamic>> submitTopUp({
    required String riderId,
    required double amount,
    required String method,
    String? upiRef,
    String? proofUrl,
    String purpose = 'TOP_UP',
  }) async {
    final response = await _apiClient.postTransactionTopup(
      gen.TopupRequest(
        riderId: riderId,
        amount: amount,
        method: method == 'UPI'
            ? 'UPI'
            : method == 'CARD'
                ? 'CARD'
                : 'CASH',
        upiRef: upiRef,
        proofUrl: proofUrl,
        purpose: purpose,
      ),
    );
    return response.toJson();
  }

  Future<Map<String, dynamic>> deleteTransactionHistory({
    required String riderId,
  }) async {
    return _apiClient.deleteTransactionHistory();
  }

  Future<Map<String, dynamic>> fetchTransactionHistory({
    required String riderId,
    int page = 1,
    int limit = 20,
  }) async {
    return _apiClient.getTransactionHistory(page, limit);
  }

  Future<Map<String, dynamic>> fetchPlans() async {
    return _apiClient.getRiderPlans();
  }

  Future<Map<String, dynamic>> subscribePlan({
    required String hubId,
    required String planId,
    required double securityDeposit,
  }) async {
    return _apiClient.postRiderPlans({
      'hubId': hubId,
      'planId': planId,
      'securityDeposit': securityDeposit,
    });
  }

  Future<Map<String, dynamic>> fetchEarnings() async {
    return _apiClient.getRiderEarnings();
  }

  Future<Map<String, dynamic>> fetchFaqs() async {
    return _apiClient.getSupportFaqs();
  }

  Future<Map<String, dynamic>> fetchTickets() async {
    return _apiClient.getSupportTickets();
  }

  Future<Map<String, dynamic>> fetchHubs() async {
    return _apiClient.getRiderHubs();
  }

  Future<Map<String, dynamic>> fetchVehicles(String hubId) async {
    final response = await _apiClient.getVehicles(hubId);
    return response.toJson();
  }

  Future<Map<String, dynamic>> syncPickup({
    required String vehicleId,
    required String hubId,
    required String bookingId,
    String? teamLeader,
    String? emergencyContact,
    String? pickupPhotoFront,
    String? pickupPhotoBack,
    String? pickupPhotoLeft,
    String? pickupPhotoRight,
    String? pickupPhotoWithVehicle,
  }) async {
    return _apiClient.postRiderSyncPickup({
      'vehicleId': vehicleId,
      'hubId': hubId,
      'bookingId': bookingId,
      if (teamLeader != null) 'teamLeader': teamLeader,
      if (emergencyContact != null) 'emergencyContact': emergencyContact,
      if (pickupPhotoFront != null) 'pickupPhotoFront': pickupPhotoFront,
      if (pickupPhotoBack != null) 'pickupPhotoBack': pickupPhotoBack,
      if (pickupPhotoLeft != null) 'pickupPhotoLeft': pickupPhotoLeft,
      if (pickupPhotoRight != null) 'pickupPhotoRight': pickupPhotoRight,
      if (pickupPhotoWithVehicle != null)
        'pickupPhotoWithVehicle': pickupPhotoWithVehicle,
    });
  }

  /// Submit a vehicle return via the rental return endpoint.
  Future<Map<String, dynamic>> submitVehicleReturn({
    required String riderId,
    required List<String> photoUrls,
    String? reason,
  }) async {
    final request = gen.VehicleReturnRequest(
      riderId: riderId,
      photoUrls: photoUrls,
      reason: reason,
    );
    return _apiClient.postRiderRentalReturn(request);
  }

  Future<Map<String, dynamic>> fetchSettings() async {
    return _apiClient.getRiderSettings();
  }

  /// Fetch rewards via the rider rewards endpoint.
  Future<Map<String, dynamic>> fetchRewards() async {
    return _apiClient.getRiderRewards();
  }

  /// Fetch referrals via the rider referrals endpoint.
  Future<Map<String, dynamic>> fetchReferrals() async {
    return _apiClient.getRiderReferrals();
  }

  Future<Map<String, dynamic>> syncPermissionState({
    required String riderId,
    required Map<String, bool> permissions,
  }) async {
    final request = gen.DevicePermissionsRequest(
      riderId: riderId,
      permissions: permissions,
    );
    return _apiClient.postRiderDevicePermissions(request);
  }

  Future<Map<String, dynamic>> syncDeviceData({
    required String type,
    required dynamic data,
  }) async {
    return _apiClient.postRiderSyncDeviceData({
      'type': type,
      'data': data,
    });
  }

  /// Refresh the session token when the current one expires.
  Future<Map<String, dynamic>> refreshSession(String refreshToken) async {
    final request = gen.RefreshTokenRequest(refreshToken: refreshToken);
    return _apiClient.postAuthRefresh(request);
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? queryParams,
  }) async {
    return _client.get(path, queryParams: queryParams);
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    return _client.post(path, body: body);
  }
}
