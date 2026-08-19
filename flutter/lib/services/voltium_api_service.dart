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

  /// Fetch legal documents (terms/privacy/refund/lease) for the onboarding
  /// legal screen. Public endpoint — no session required. SWR-cached so the
  /// legal wall renders instantly offline from the last successful fetch.
  ///
  /// Returns the raw envelope (`{ success, data: [...] }`); the caller reads
  /// `data` as a List of `{ type, title, content, updatedAt }`.
  Future<Map<String, dynamic>> fetchLegalDocuments() async {
    return _client.getWithSWR('/api/rider/legal');
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
    bool advanceRentPaid = false,
  }) async {
    return _apiClient.postRiderPlans({
      'hubId': hubId,
      'planId': planId,
      'securityDeposit': securityDeposit,
      'advanceRentPaid': advanceRentPaid,
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

  // PR-ONBOARDING-2026-08-11 (audit 2.5): live team-leader lookup per hub.
  // Replaces the hardcoded 3-entry list in `kPickupTeamLeaderOptions` so a
  // new TL added in admin shows up immediately on the rider side without
  // shipping a new app build. Falls back to the legacy const list if the
  // endpoint is unavailable.
  Future<List<Map<String, dynamic>>> fetchTeamLeaders(String hubId) async {
    final raw = await _apiClient.getRiderTeamLeaders(hubId);
    final data = raw['data'];
    if (data is List) {
      return data.cast<Map<String, dynamic>>();
    }
    return const [];
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
    // PR-PICKUP-OTP: the short-lived HMAC receipt issued by
    // /api/auth/verify-phone on successful emergency-contact OTP
    // verification. The server validates it (signature + 15-min TTL +
    // phone match) so the OTP gate is no longer client-only.
    String? emergencyContactReceipt,
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
      if (emergencyContactReceipt != null)
        'emergencyContactReceipt': emergencyContactReceipt,
      if (pickupPhotoFront != null) 'pickupPhotoFront': pickupPhotoFront,
      if (pickupPhotoBack != null) 'pickupPhotoBack': pickupPhotoBack,
      if (pickupPhotoLeft != null) 'pickupPhotoLeft': pickupPhotoLeft,
      if (pickupPhotoRight != null) 'pickupPhotoRight': pickupPhotoRight,
      if (pickupPhotoWithVehicle != null)
        'pickupPhotoWithVehicle': pickupPhotoWithVehicle,
    });
  }

  /// Submit a vehicle return via the rental return endpoint.
  ///
  /// PR-VER-2026-08-06 (RENTAL P0-1): canonical body is
  /// `{ returnPhotos, reason }` — riderId was dropped because the server
  /// resolves identity from the session. The legacy `photoUrls` field name
  /// is gone from the wire contract.
  Future<Map<String, dynamic>> submitVehicleReturn({
    required List<String> returnPhotos,
    String? reason,
  }) async {
    final request = gen.VehicleReturnRequest(
      returnPhotos: returnPhotos,
      reason: reason,
    );
    return _apiClient.postRiderRentalReturn(request);
  }

  /// Fire the rider's SOS alert to the backend.
  ///
  /// PR-VER-2026-08-06 (EMERGENCY P0-1): the SOS long-press used to only
  /// dial 112 locally — Voltium staff had no awareness of the event. This
  /// call records the alert server-side (audit log) with best-effort
  /// location. It is called fire-and-forget BEFORE dialing: a slow network
  /// must never delay an emergency call, and a failure is non-blocking.
  ///
  /// PR-14: the payload now also carries the rider's emergency contacts
  /// (kept in SharedPreferences — see `EmergencyContactsService`). The
  /// backend fans the alert out to those contacts via MSG91 SMS and posts
  /// a Slack critical alert. Fanout is best-effort server-side; this
  /// method does not block on the response.
  Future<Map<String, dynamic>> triggerSos({
    double? latitude,
    double? longitude,
    String? timestamp,
    String? triggeredVia,
    List<Map<String, String>>? contacts,
  }) async {
    return _client.post('/api/emergency/sos', body: {
      if (latitude != null) 'latitude': latitude,
      if (longitude != null) 'longitude': longitude,
      if (timestamp != null) 'timestamp': timestamp,
      'triggeredVia': triggeredVia ?? 'long_press',
      if (contacts != null && contacts.isNotEmpty) 'contacts': contacts,
    });
  }

  Future<Map<String, dynamic>> fetchSettings() async {
    return _apiClient.getRiderSettings();
  }

  /// PR-39 (PROFILE P0-6): pushes a locally-stored earnings entry to the
  /// backend. The audit's finding was that `SharedPreferences`-only
  /// earnings entries were stranded on the device — they showed up in
  /// the UI but never made it to the server, so the admin's earnings
  /// analytics never saw them.
  ///
  /// The entry is sent as a single POST; on failure the caller should
  /// fall back to the local save and re-try on the next app launch via
  /// the existing sync queue. Returns the server's response (which
  /// contains the canonical id the entry should be stored under).
  Future<Map<String, dynamic>> createEarning({
    required DateTime date,
    required String platform,
    required double amount,
    required int trips,
    required double hours,
    String? notes,
  }) async {
    return _client.post('/api/rider/earnings', body: {
      'date': date.toIso8601String(),
      'platform': platform,
      'amount': amount,
      'trips': trips,
      'hours': hours,
      if (notes != null) 'notes': notes,
    });
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

  /// Verify the rider device lock password against server.
  Future<Map<String, dynamic>> verifyLockPassword(String password) async {
    return _apiClient.postRiderDeviceVerifyLock({
      'password': password,
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

  Future<Map<String, dynamic>> put(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    return _client.put(path, body: body);
  }

  Future<Map<String, dynamic>> delete(
    String path, {
    Map<String, String>? queryParams,
  }) async {
    return _client.delete(path, queryParams: queryParams);
  }
}
