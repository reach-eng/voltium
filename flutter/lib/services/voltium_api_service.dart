import 'dart:io';
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

  static set instance(VoltiumApiService? val) => _instance = val;

  factory VoltiumApiService() {
    _instance ??= VoltiumApiService.withClient(ApiClient());
    return _instance!;
  }

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
    return _client.delete('/api/transaction/history');
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
    final response = await _apiClient.getAdminHubs();
    return response.toJson();
  }

  Future<Map<String, dynamic>> fetchVehicles(String hubId) async {
    final response = await _apiClient.getVehicles(hubId);
    return response.toJson();
  }

  Future<Map<String, dynamic>> syncPickup({
    required String vehicleId,
    required String hubId,
    required String bookingId,
  }) async {
    return _apiClient.postRiderSyncPickup({
      'vehicleId': vehicleId,
      'hubId': hubId,
      'bookingId': bookingId,
    });
  }

  Future<Map<String, dynamic>> submitVehicleReturn({
    required String riderId,
    required List<String> photoUrls,
    String? reason,
  }) async {
    return post('/api/rider/vehicle-return', body: {
      'riderId': riderId,
      'photoUrls': photoUrls,
      if (reason != null) 'reason': reason,
    });
  }

  Future<Map<String, dynamic>> fetchSettings() async {
    return _apiClient.getRiderSettings();
  }

  Future<Map<String, dynamic>> fetchRewards() async {
    return get('/api/rewards', queryParams: {'page': '1', 'limit': '10'});
  }

  Future<Map<String, dynamic>> fetchReferrals() async {
    return get('/api/referrals');
  }

  Future<Map<String, dynamic>> syncPermissionState({
    required String riderId,
    required Map<String, bool> permissions,
  }) async {
    return post('/api/device/permissions', body: {
      'riderId': riderId,
      'permissions': permissions,
    });
  }

  Future<Map<String, dynamic>> syncDeviceData({
    required String type,
    required dynamic data,
  }) async {
    return post('/api/device/data', body: {
      'type': type,
      'data': data,
    });
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
