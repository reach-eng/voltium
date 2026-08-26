// GENERATED CODE - DO NOT MODIFY BY HAND
// Generated from OpenAPI spec using generate-client.ts

import '../api_client.dart';
import 'api_models.dart';

class VoltiumApiClient {
  final ApiClient _client;

  VoltiumApiClient(this._client);

  /// Send OTP to phone number
  Future<SendOtpResponse> postAuthSendOtp(SendOtpRequest request) async {
    final response =
        await _client.post('/api/auth/send-otp', body: request.toJson());
    return SendOtpResponse.fromJson(response);
  }

  /// Verify OTP and establish session
  Future<VerifyOtpResponse> postAuthVerifyOtp(VerifyOtpRequest request) async {
    final response =
        await _client.post('/api/auth/verify-otp', body: request.toJson());
    return VerifyOtpResponse.fromJson(response);
  }

  /// Get rider profile with all related data
  Future<RiderProfileResponse> getRiderProfile() async {
    final response = await _client.get('/api/rider/profile');
    return RiderProfileResponse.fromJson(response);
  }

  /// Update rider profile fields
  Future<Map<String, dynamic>> putRiderProfile(
      UpdateProfileRequest request) async {
    final response =
        await _client.put('/api/rider/profile', body: request.toJson());
    return response;
  }

  /// Get KYC submission status
  Future<KycStatusResponse> getRiderKyc() async {
    final response = await _client.get('/api/rider/kyc');
    return KycStatusResponse.fromJson(response);
  }

  /// Submit KYC documents
  Future<SubmitKycResponse> postRiderKyc(SubmitKycRequest request) async {
    final response =
        await _client.post('/api/rider/kyc', body: request.toJson());
    return SubmitKycResponse.fromJson(response);
  }

  /// Get guarantor status
  Future<Map<String, dynamic>> getRiderGuarantor() async {
    final response = await _client.get('/api/rider/guarantor');
    return response;
  }

  /// Submit guarantor details
  Future<Map<String, dynamic>> postRiderGuarantor(
      Map<String, dynamic> request) async {
    final response = await _client.post('/api/rider/guarantor', body: request);
    return response;
  }

  /// Submit a top-up or security deposit payment
  Future<TopupResponse> postTransactionTopup(TopupRequest request) async {
    final response =
        await _client.post('/api/transaction/topup', body: request.toJson());
    return TopupResponse.fromJson(response);
  }

  /// Get transaction history
  Future<Map<String, dynamic>> getTransactionHistory(
      int? page, int? limit) async {
    final queryParams = <String, String>{
      if (page != null) 'page': page.toString(),
      if (limit != null) 'limit': limit.toString(),
    };
    final response =
        await _client.get('/api/transaction/history', queryParams: queryParams);
    return response;
  }

  /// Delete History
  Future<Map<String, dynamic>> deleteTransactionHistory() async {
    final response = await _client.delete('/api/transaction/history');
    return response;
  }

  /// Book a vehicle rental
  Future<BookRentalResponse> postRentalBook(BookRentalRequest request) async {
    final response =
        await _client.post('/api/rental/book', body: request.toJson());
    return BookRentalResponse.fromJson(response);
  }

  /// List rider support tickets
  Future<Map<String, dynamic>> getSupportTickets() async {
    final response = await _client.get('/api/support/tickets');
    return response;
  }

  /// Create a support ticket
  Future<TicketResponse> postSupportTickets(CreateTicketRequest request) async {
    final response =
        await _client.post('/api/support/tickets', body: request.toJson());
    return TicketResponse.fromJson(response);
  }

  /// Request a signed upload URL for a file
  Future<RequestUploadUrlResponse> postFilesRequestUpload(
      RequestUploadUrlRequest request) async {
    final response =
        await _client.post('/api/files/request-upload', body: request.toJson());
    return RequestUploadUrlResponse.fromJson(response);
  }

  /// Confirm a file upload was completed
  Future<Map<String, dynamic>> postFilesConfirmUpload(
      ConfirmUploadRequest request) async {
    final response =
        await _client.post('/api/files/confirm-upload', body: request.toJson());
    return response;
  }

  /// Serve a private file (proxied with auth check)
  Future<Map<String, dynamic>> getFilespath(String path) async {
    final response = await _client.get('/api/files/$path');
    return response;
  }

  /// Update {path}
  Future<Map<String, dynamic>> putFilespath(
      Map<String, dynamic> request) async {
    final response = await _client.put('/api/files/{path}', body: request);
    return response;
  }

  /// Admin login with email + password
  Future<Map<String, dynamic>> postAdminAuthLogin(
      Map<String, dynamic> request) async {
    final response = await _client.post('/api/admin/auth/login', body: request);
    return response;
  }

  /// Dev-only auto-login (disabled in production)
  Future<Map<String, dynamic>> postAdminAuthAutoLogin() async {
    final response = await _client.post('/api/admin/auth/auto-login');
    return response;
  }

  /// Get current admin session profile
  Future<Map<String, dynamic>> getAdminAuthMe() async {
    final response = await _client.get('/api/admin/auth/me');
    return response;
  }

  /// Refresh admin session token (sets new cookie)
  Future<Map<String, dynamic>> postAdminAuthRefresh(
      Map<String, dynamic> request) async {
    final response =
        await _client.post('/api/admin/auth/refresh', body: request);
    return response;
  }

  /// Clear admin session cookie and bump token version
  Future<Map<String, dynamic>> postAdminAuthLogout() async {
    final response = await _client.post('/api/admin/auth/logout');
    return response;
  }

  /// Review KYC submission (approve/reject/request-info)
  Future<Map<String, dynamic>> postAdminKyc(ReviewKycRequest request) async {
    final response =
        await _client.post('/api/admin/kyc', body: request.toJson());
    return response;
  }

  /// Review deposit (approve/reject/refund/forfeit)
  Future<Map<String, dynamic>> postAdminDeposits(
      ReviewDepositRequest request) async {
    final response =
        await _client.post('/api/admin/deposits', body: request.toJson());
    return response;
  }

  /// List Deposits
  Future<Map<String, dynamic>> getAdminDeposits() async {
    final response = await _client.get('/api/admin/deposits');
    return response;
  }

  /// Bulk update Deposits
  Future<Map<String, dynamic>> putAdminDeposits(
      Map<String, dynamic> request) async {
    final response = await _client.put('/api/admin/deposits', body: request);
    return response;
  }

  /// Approve/reject/reverse a transaction
  Future<Map<String, dynamic>> postAdminTransactions(
      ApproveTransactionRequest request) async {
    final response =
        await _client.post('/api/admin/transactions', body: request.toJson());
    return response;
  }

  /// List Transactions
  Future<Map<String, dynamic>> getAdminTransactions() async {
    final response = await _client.get('/api/admin/transactions');
    return response;
  }

  /// Bulk update Transactions
  Future<Map<String, dynamic>> putAdminTransactions(
      Map<String, dynamic> request) async {
    final response =
        await _client.put('/api/admin/transactions', body: request);
    return response;
  }

  /// List rider notifications
  Future<ListNotificationsResponse> getRiderNotifications() async {
    final response = await _client.get('/api/rider/notifications');
    return ListNotificationsResponse.fromJson(response);
  }

  /// Bulk update Notifications
  Future<Map<String, dynamic>> putRiderNotifications(
      Map<String, dynamic> request) async {
    final response =
        await _client.put('/api/rider/notifications', body: request);
    return response;
  }

  /// List vehicles by hub
  Future<ListVehiclesResponse> getVehicles(String hubId) async {
    final queryParams = <String, String>{
      'hubId': hubId.toString(),
    };
    final response =
        await _client.get('/api/vehicles', queryParams: queryParams);
    return ListVehiclesResponse.fromJson(response);
  }

  /// List all hubs
  Future<ListHubsResponse> getAdminHubs() async {
    final response = await _client.get('/api/admin/hubs');
    return ListHubsResponse.fromJson(response);
  }

  /// Create Hubs
  Future<Map<String, dynamic>> postAdminHubs(
      Map<String, dynamic> request) async {
    final response = await _client.post('/api/admin/hubs', body: request);
    return response;
  }

  /// Bulk update Hubs
  Future<Map<String, dynamic>> putAdminHubs(
      Map<String, dynamic> request) async {
    final response = await _client.put('/api/admin/hubs', body: request);
    return response;
  }

  /// Delete Hubs
  Future<Map<String, dynamic>> deleteAdminHubs() async {
    final response = await _client.delete('/api/admin/hubs');
    return response;
  }

  /// List riders (paginated)
  Future<Map<String, dynamic>> getAdminRiders(
      int? page, int? limit, String? search, String? status) async {
    final queryParams = <String, String>{
      if (page != null) 'page': page.toString(),
      if (limit != null) 'limit': limit.toString(),
      if (search != null) 'search': search.toString(),
      if (status != null) 'status': status.toString(),
    };
    final response =
        await _client.get('/api/admin/riders', queryParams: queryParams);
    return response;
  }

  /// Create rider (admin)
  Future<Map<String, dynamic>> postAdminRiders(
      CreateRiderRequest request) async {
    final response =
        await _client.post('/api/admin/riders', body: request.toJson());
    return response;
  }

  /// Update rider (admin)
  Future<Map<String, dynamic>> putAdminRiders(
      CreateRiderRequest request, String id) async {
    final queryParams = <String, String>{
      'id': id.toString(),
    };
    final response = await _client.put('/api/admin/riders',
        queryParams: queryParams, body: request.toJson());
    return response;
  }

  /// Delete rider (admin)
  Future<Map<String, dynamic>> deleteAdminRiders(String id) async {
    final queryParams = <String, String>{
      'id': id.toString(),
    };
    final response =
        await _client.delete('/api/admin/riders', queryParams: queryParams);
    return response;
  }

  /// Run wallet reconciliation across all riders
  Future<Map<String, dynamic>> getAdminReconciliation() async {
    final response = await _client.get('/api/admin/reconciliation');
    return response;
  }

  /// Verify phone OTP
  Future<VerifyPhoneResponse> postAuthVerifyPhone(
      VerifyPhoneRequest request) async {
    final response =
        await _client.post('/api/auth/verify-phone', body: request.toJson());
    return VerifyPhoneResponse.fromJson(response);
  }

  /// Request read URL
  Future<RequestReadUrlResponse> postFilesRequestRead(
      RequestReadUrlRequest request) async {
    final response =
        await _client.post('/api/files/request-read', body: request.toJson());
    return RequestReadUrlResponse.fromJson(response);
  }

  /// Fetch plan pricing
  Future<Map<String, dynamic>> getPricing(
      String hubId, String basePrice) async {
    final queryParams = <String, String>{
      'hubId': hubId.toString(),
      'basePrice': basePrice.toString(),
    };
    final response =
        await _client.get('/api/pricing', queryParams: queryParams);
    return response;
  }

  /// Rider dashboard
  Future<Map<String, dynamic>> getRiderDashboard() async {
    final response = await _client.get('/api/rider/dashboard');
    return response;
  }

  /// Submit device telemetry or token
  Future<Map<String, dynamic>> postRiderDevice(
      Map<String, dynamic> request) async {
    final response = await _client.post('/api/rider/device', body: request);
    return response;
  }

  /// List Device
  Future<Map<String, dynamic>> getRiderDevice() async {
    final response = await _client.get('/api/rider/device');
    return response;
  }

  /// List earnings
  Future<Map<String, dynamic>> getRiderEarnings() async {
    final response = await _client.get('/api/rider/earnings');
    return response;
  }

  /// Add earning entry
  Future<Map<String, dynamic>> postRiderEarnings(
      Map<String, dynamic> request) async {
    final response = await _client.post('/api/rider/earnings', body: request);
    return response;
  }

  /// Fetch rental offers
  Future<Map<String, dynamic>> getRiderOffers() async {
    final response = await _client.get('/api/rider/offers');
    return response;
  }

  /// List available plans
  Future<Map<String, dynamic>> getRiderPlans() async {
    final response = await _client.get('/api/rider/plans');
    return response;
  }

  /// Subscribe to plan
  Future<Map<String, dynamic>> postRiderPlans(
      Map<String, dynamic> request) async {
    final response = await _client.post('/api/rider/plans', body: request);
    return response;
  }

  /// Fetch rider pricing info
  Future<Map<String, dynamic>> getRiderPricing() async {
    final response = await _client.get('/api/rider/pricing');
    return response;
  }

  /// Fetch referral status summary
  Future<Map<String, dynamic>> getRiderReferral() async {
    final response = await _client.get('/api/rider/referral');
    return response;
  }

  /// List referrals
  Future<Map<String, dynamic>> getRiderReferrals() async {
    final response = await _client.get('/api/rider/referrals');
    return response;
  }

  /// Fetch rewards
  Future<Map<String, dynamic>> getRiderRewards() async {
    final response = await _client.get('/api/rider/rewards');
    return response;
  }

  /// Fetch system settings
  Future<Map<String, dynamic>> getRiderSettings() async {
    final response = await _client.get('/api/rider/settings');
    return response;
  }

  /// Sync device telemetry logs
  Future<Map<String, dynamic>> postRiderSyncDeviceData(
      Map<String, dynamic> request) async {
    final response =
        await _client.post('/api/rider/sync/device-data', body: request);
    return response;
  }

  /// Finalise pickup checklists
  Future<Map<String, dynamic>> postRiderSyncPickup(
      Map<String, dynamic> request) async {
    final response =
        await _client.post('/api/rider/sync/pickup', body: request);
    return response;
  }

  /// Check vehicle availability for pickup
  Future<Map<String, dynamic>> getRiderSyncPickupVehicle(
      String hubId, String vehicleId) async {
    final queryParams = <String, String>{
      'hubId': hubId.toString(),
      'vehicleId': vehicleId.toString(),
    };
    final response = await _client.get('/api/rider/sync/pickup/vehicle',
        queryParams: queryParams);
    return response;
  }

  /// Register FCM device token
  Future<Map<String, dynamic>> postRidersRegisterToken(
      Map<String, dynamic> request) async {
    final response =
        await _client.post('/api/rider/register-token', body: request);
    return response;
  }

  /// Fetch shifts by hub and date
  Future<Map<String, dynamic>> getShifts(String hubId, String date) async {
    final queryParams = <String, String>{
      'hubId': hubId.toString(),
      'date': date.toString(),
    };
    final response = await _client.get('/api/shifts', queryParams: queryParams);
    return response;
  }

  /// Fetch support chat messages
  Future<Map<String, dynamic>> getSupportChat() async {
    final response = await _client.get('/api/support/chat');
    return response;
  }

  /// Send chat message
  Future<Map<String, dynamic>> postSupportChat(
      Map<String, dynamic> request) async {
    final response = await _client.post('/api/support/chat', body: request);
    return response;
  }

  /// List active FAQs
  Future<Map<String, dynamic>> getSupportFaqs() async {
    final response = await _client.get('/api/support/faqs');
    return response;
  }

  /// Request a transaction / payment session
  Future<Map<String, dynamic>> postTransactionRequest(
      Map<String, dynamic> request) async {
    final response =
        await _client.post('/api/transaction/request', body: request);
    return response;
  }

  /// Health check endpoint
  Future<Map<String, dynamic>> getHealth() async {
    final response = await _client.get('/api/health');
    return response;
  }

  /// Create Refresh
  Future<Map<String, dynamic>> postAuthRefresh(
      RefreshTokenRequest request) async {
    final response =
        await _client.post('/api/auth/refresh', body: request.toJson());
    return response;
  }

  /// Update Device Permissions
  Future<Map<String, dynamic>> postRiderDevicePermissions(
      DevicePermissionsRequest request) async {
    final response = await _client.post('/api/rider/device/permissions',
        body: request.toJson());
    return response;
  }

  /// Bulk update Direct Upload
  Future<Map<String, dynamic>> putFilesDirectUpload(
      Map<String, dynamic> request) async {
    final response =
        await _client.put('/api/files/direct-upload', body: request);
    return response;
  }

  /// Update {fileRecordId}
  Future<Map<String, dynamic>> putFilesLocalUploadfileRecordId(
      Map<String, dynamic> request) async {
    final response = await _client.put('/api/files/local-upload/{fileRecordId}',
        body: request);
    return response;
  }

  /// Create Verify Lock
  Future<Map<String, dynamic>> postRiderDeviceVerifyLock(
      Map<String, dynamic> request) async {
    final response =
        await _client.post('/api/rider/device/verify-lock', body: request);
    return response;
  }

  /// List Hubs
  Future<Map<String, dynamic>> getRiderHubs() async {
    final response = await _client.get('/api/rider/hubs');
    return response;
  }

  /// Create Return
  Future<Map<String, dynamic>> postRiderRentalReturn(
      VehicleReturnRequest request) async {
    final response =
        await _client.post('/api/rider/rental/return', body: request.toJson());
    return response;
  }
}
