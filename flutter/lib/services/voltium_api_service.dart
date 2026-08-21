// PR-13 (2026-08-22): backward-compat shim.
//
// The original `VoltiumApiService` (311 lines) was a wrapper around the
// generated `VoltiumApiClient` whose only real work was `.toJson()`
// round-trips that threw away the typed responses the generator
// gives us. That wrapper has been deleted from production code
// paths in `lib/`; every caller now talks to the generated client
// directly (via the `voltiumApiClientProvider`/`apiClientProvider`
// Riverpod providers, or via a fresh `VoltiumApiClient(ApiClient())`
// for non-widget contexts).
//
// This file is preserved ONLY so the existing test suite — which
// fakes `VoltiumApiService` via `VoltiumApiService.instance = ...`
// — keeps compiling and running. Each method here is a 1-line
// delegation to the generated client; the shim is a no-op at
// runtime.
//
// A follow-up PR will migrate the test fakes to mock
// `VoltiumApiClient` directly and delete this file.

import 'package:universal_io/io.dart';
import 'package:flutter/foundation.dart';
import '../core/network/api_client.dart';
import '../core/network/files_repository.dart';
import '../core/network/generated/api_client.dart';
import '../core/network/generated/api_models.dart' as gen;

class VoltiumApiService {
  final ApiClient _client;
  final VoltiumApiClient _apiClient;
  final FilesRepository _filesRepository;

  static VoltiumApiService? _instance;

  factory VoltiumApiService() {
    _instance ??= VoltiumApiService.withClient(ApiClient());
    return _instance!;
  }

  @visibleForTesting
  static set instance(VoltiumApiService? val) => _instance = val;

  VoltiumApiService.withClient(ApiClient client)
      : _client = client,
        _apiClient = VoltiumApiClient(client),
        _filesRepository = FilesRepository(client, VoltiumApiClient(client));

  Future<Map<String, dynamic>> verifyPhone({
    required String phone,
    required String otp,
  }) async {
    return (await _apiClient.postAuthVerifyPhone(
      gen.VerifyPhoneRequest(phone: phone, otp: otp),
    ))
        .toJson();
  }

  Future<Map<String, dynamic>> fetchRiderProfile({
    String? riderId,
    String? phone,
  }) async {
    return (await _apiClient.getRiderProfile()).toJson();
  }

  Future<Map<String, dynamic>> fetchLegalDocuments() async {
    return _client.getWithSWR('/api/rider/legal');
  }

  Future<Map<String, dynamic>> updateProfile({
    required String riderId,
    required Map<String, dynamic> data,
  }) async {
    return _apiClient.putRiderProfile(gen.UpdateProfileRequest.fromJson(data));
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
    return (await _apiClient.postTransactionTopup(
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
    ))
        .toJson();
  }

  Future<Map<String, dynamic>> fetchTransactionHistory({
    required String riderId,
    int page = 1,
    int limit = 20,
  }) async =>
      _apiClient.getTransactionHistory(page, limit);

  Future<Map<String, dynamic>> fetchPlans() async => _apiClient.getRiderPlans();

  Future<Map<String, dynamic>> subscribePlan({
    required String hubId,
    required String planId,
    required double securityDeposit,
    bool advanceRentPaid = false,
  }) =>
      _apiClient.postRiderPlans({
        'hubId': hubId,
        'planId': planId,
        'securityDeposit': securityDeposit,
        'advanceRentPaid': advanceRentPaid,
      });

  Future<Map<String, dynamic>> fetchEarnings() async =>
      _apiClient.getRiderEarnings();

  Future<Map<String, dynamic>> fetchFaqs() async => _apiClient.getSupportFaqs();

  Future<Map<String, dynamic>> fetchTickets() async =>
      _apiClient.getSupportTickets();

  Future<Map<String, dynamic>> fetchHubs() async => _apiClient.getRiderHubs();

  Future<List<Map<String, dynamic>>> fetchTeamLeaders(String hubId) async {
    final raw = await _apiClient.getRiderTeamLeaders(hubId);
    final data = raw['data'];
    if (data is List) return data.cast<Map<String, dynamic>>();
    return const [];
  }

  Future<Map<String, dynamic>> fetchVehicles(String hubId) async {
    return (await _apiClient.getVehicles(hubId)).toJson();
  }

  Future<Map<String, dynamic>> syncPickup({
    required String vehicleId,
    required String hubId,
    required String bookingId,
    String? teamLeader,
    String? emergencyContact,
    String? emergencyContactReceipt,
    String? pickupPhotoFront,
    String? pickupPhotoBack,
    String? pickupPhotoLeft,
    String? pickupPhotoRight,
    String? pickupPhotoWithVehicle,
  }) =>
      _apiClient.postRiderSyncPickup({
        'vehicleId': vehicleId,
        'hubId': hubId,
        'bookingId': bookingId,
        if (teamLeader != null) 'teamLeader': teamLeader,
        if (emergencyContact != null) 'emergencyContact': emergencyContact,
        if (emergencyContactReceipt != null)
          'emergencyContactReceipt': emergencyContactReceipt,
        if (pickupPhotoFront != null) 'pickupPhotoFront': pickupPhotoFront,
        if (pickupPhotoBack != null) 'pickupPhotoBack': pickupPhotoBack,
        if (pickupPhotoLeft != null) 'pickupPhotoLeft': pickupPhotoLeft,
        if (pickupPhotoRight != null) 'pickupPhotoRight': pickupPhotoRight,
        if (pickupPhotoWithVehicle != null)
          'pickupPhotoWithVehicle': pickupPhotoWithVehicle,
      });

  Future<Map<String, dynamic>> submitVehicleReturn({
    required List<String> returnPhotos,
    String? reason,
  }) =>
      _apiClient.postRiderRentalReturn(
        gen.VehicleReturnRequest(returnPhotos: returnPhotos, reason: reason),
      );

  Future<Map<String, dynamic>> triggerSos({
    double? latitude,
    double? longitude,
    String? timestamp,
    String? triggeredVia,
    List<Map<String, String>>? contacts,
  }) =>
      _client.post('/api/emergency/sos', body: {
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
        if (timestamp != null) 'timestamp': timestamp,
        'triggeredVia': triggeredVia ?? 'long_press',
        if (contacts != null && contacts.isNotEmpty) 'contacts': contacts,
      });

  Future<Map<String, dynamic>> fetchSettings() async =>
      _apiClient.getRiderSettings();

  Future<Map<String, dynamic>> createEarning({
    required DateTime date,
    required String platform,
    required double amount,
    required int trips,
    required double hours,
    String? notes,
  }) =>
      _client.post('/api/rider/earnings', body: {
        'date': date.toIso8601String(),
        'platform': platform,
        'amount': amount,
        'trips': trips,
        'hours': hours,
        if (notes != null) 'notes': notes,
      });

  Future<Map<String, dynamic>> fetchRewards() async =>
      _apiClient.getRiderRewards();

  Future<Map<String, dynamic>> fetchReferrals() async =>
      _apiClient.getRiderReferrals();

  Future<Map<String, dynamic>> syncPermissionState({
    required String riderId,
    required Map<String, bool> permissions,
  }) =>
      _apiClient.postRiderDevicePermissions(
        gen.DevicePermissionsRequest(
            riderId: riderId, permissions: permissions),
      );

  Future<Map<String, dynamic>> syncDeviceData({
    required String type,
    required dynamic data,
  }) =>
      _apiClient.postRiderSyncDeviceData({'type': type, 'data': data});

  Future<Map<String, dynamic>> verifyLockPassword(String password) =>
      _apiClient.postRiderDeviceVerifyLock({'password': password});

  Future<Map<String, dynamic>> refreshSession(String refreshToken) => _apiClient
      .postAuthRefresh(gen.RefreshTokenRequest(refreshToken: refreshToken));

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? queryParams,
  }) =>
      _client.get(path, queryParams: queryParams);

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
  }) =>
      _client.post(path, body: body);

  Future<Map<String, dynamic>> put(
    String path, {
    Map<String, dynamic>? body,
  }) =>
      _client.put(path, body: body);

  Future<Map<String, dynamic>> delete(
    String path, {
    Map<String, String>? queryParams,
  }) =>
      _client.delete(path, queryParams: queryParams);
}
