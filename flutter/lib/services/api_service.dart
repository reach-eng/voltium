import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../main.dart';
import 'monitoring_service.dart';
import 'secure_storage_service.dart';

typedef RequestInterceptor = Future<Map<String, String>> Function(
  String method,
  String path,
  Map<String, String> headers,
);

typedef ResponseInterceptor = Future<Map<String, dynamic>> Function(
  String method,
  String path,
  Map<String, dynamic> response,
  int statusCode,
  Duration duration,
);

class ApiService {
  static RequestInterceptor? _requestInterceptor;
  static ResponseInterceptor? _responseInterceptor;

  static void setRequestInterceptor(RequestInterceptor interceptor) {
    _requestInterceptor = interceptor;
  }

  static void setResponseInterceptor(ResponseInterceptor interceptor) {
    _responseInterceptor = interceptor;
  }

  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  static String get _baseUrl {
    const envUrl = String.fromEnvironment('API_URL');
    if (envUrl.isNotEmpty) return envUrl;
    if (kIsWeb) return 'http://localhost:8081';

    if (kDebugMode) {
      try {
        if (Platform.isAndroid) return 'http://10.0.2.2:8081';
        if (Platform.isIOS) return 'http://localhost:8081';
      } catch (_) {
        return 'http://localhost:8081';
      }
    }

    return 'https://api.voltium.in';
  }

  static const Duration _timeout = Duration(seconds: 30);
  static const int _maxRetries = 3;
  static const Duration _initialRetryDelay = Duration(milliseconds: 500);

  String _generateRequestId() {
    final r = Random();
    return '${DateTime.now().millisecondsSinceEpoch}-${r.nextInt(99999)}';
  }

  Future<Map<String, String>> _headers(
      {String method = 'GET', String path = ''}) async {
    final token = await SecureStorageService().getToken();
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Request-Id': _generateRequestId(),
      if (token != null) 'Authorization': 'Bearer $token',
    };
    if (_requestInterceptor != null) {
      return await _requestInterceptor!(method, path, headers);
    }
    return headers;
  }

  Future<bool> _tryRefreshToken() async {
    final refreshToken = await SecureStorageService().getRefreshToken();
    if (refreshToken == null) return false;

    try {
      final uri = Uri.parse('$_baseUrl/api/auth/refresh');
      final response = await http
          .post(uri,
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({'refreshToken': refreshToken}))
          .timeout(_timeout);

      if (response.statusCode == 200) {
        final body = jsonDecode(response.body);
        final data = body['data'] as Map<String, dynamic>? ?? body;
        final newToken = data['token'] as String?;
        final newRefreshToken = data['refreshToken'] as String?;

        if (newToken != null) {
          await SecureStorageService().setToken(newToken);
          if (newRefreshToken != null) {
            await SecureStorageService().setRefreshToken(newRefreshToken);
          }
          return true;
        }
      }
    } catch (e) {
      debugPrint('ApiService: Token refresh failed: $e');
    }

    await SecureStorageService().clearAll();
    return false;
  }

  Future<Map<String, dynamic>> _executeWithRefresh(
    Future<Map<String, dynamic>> Function() request,
  ) async {
    try {
      return await request();
    } on ApiException catch (e) {
      if (e.statusCode == 401) {
        final refreshed = await _tryRefreshToken();
        if (refreshed) {
          return await request();
        }
      }
      rethrow;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Domain-specific endpoints
  // ════════════════════════════════════════════════════════════════════════

  /// `GET /api/rider/profile?phone=xxx` or `?riderId=xxx`
  Future<Map<String, dynamic>> fetchRiderProfile({
    String? riderId,
    String? phone,
  }) async {
    assert(riderId != null || phone != null,
        'Either riderId or phone must be provided');

    final params = <String, String>{};
    if (riderId != null) params['riderId'] = riderId;
    if (phone != null) params['phone'] = phone;

    return get('/api/rider/profile', queryParams: params);
  }

  /// `GET /api/rider/plans` - Fetch available rental plans
  Future<Map<String, dynamic>> fetchPlans() async {
    return get('/api/rider/plans');
  }

  /// `POST /api/rider/plans` - Subscribe to a plan
  Future<Map<String, dynamic>> subscribePlan({
    required String riderId,
    required String planId,
  }) async {
    return post('/api/rider/plans', body: {
      'riderId': riderId,
      'planId': planId,
    });
  }

  /// `GET /api/admin/hubs` - Fetch available hubs
  Future<Map<String, dynamic>> fetchHubs() async {
    return get('/api/admin/hubs');
  }

  /// `POST /api/rider/sync/pickup` - Finalise pickup
  Future<Map<String, dynamic>> syncPickup({
    required String riderId,
    required String vehicleId,
    required String hubId,
    String? teamLeader,
    String? emergencyContact,
    String? pickupPhoto,
    String? pickupPhotoFront,
    String? pickupPhotoBack,
    String? pickupPhotoLeft,
    String? pickupPhotoRight,
    String? pickupPhotoWithVehicle,
  }) async {
    return post('/api/rider/sync/pickup', body: {
      'riderId': riderId,
      'vehicleId': vehicleId,
      'hubId': hubId,
      if (teamLeader != null) 'teamLeader': teamLeader,
      if (emergencyContact != null) 'emergencyContact': emergencyContact,
      if (pickupPhoto != null) 'pickupPhoto': pickupPhoto,
      if (pickupPhotoFront != null) 'pickupPhotoFront': pickupPhotoFront,
      if (pickupPhotoBack != null) 'pickupPhotoBack': pickupPhotoBack,
      if (pickupPhotoLeft != null) 'pickupPhotoLeft': pickupPhotoLeft,
      if (pickupPhotoRight != null) 'pickupPhotoRight': pickupPhotoRight,
      if (pickupPhotoWithVehicle != null)
        'pickupPhotoWithVehicle': pickupPhotoWithVehicle,
    });
  }

  /// `GET /api/transaction/history?riderId=xxx&page=1&limit=20`
  Future<Map<String, dynamic>> fetchTransactionHistory({
    required String riderId,
    int page = 1,
    int limit = 20,
  }) async {
    return get('/api/transaction/history', queryParams: {
      'riderId': riderId,
      'page': page.toString(),
      'limit': limit.toString(),
    });
  }

  /// `DELETE /api/transaction/history?riderId=xxx`
  Future<Map<String, dynamic>> deleteTransactionHistory({
    required String riderId,
  }) async {
    return delete('/api/transaction/history', queryParams: {
      'riderId': riderId,
    });
  }

  /// `POST /api/auth/send-otp`
  Future<Map<String, dynamic>> sendOtp(
      {required String phone, String? referralCode}) async {
    final body = <String, dynamic>{'phone': phone};
    if (referralCode != null && referralCode.isNotEmpty) {
      body['referralCode'] = referralCode;
    }
    return post('/api/auth/send-otp', body: body);
  }

  Future<Map<String, dynamic>> verifyOtp({
    required String phone,
    required String otp,
  }) async {
    return post('/api/auth/verify-otp', body: {'phone': phone, 'otp': otp});
  }

  Future<Map<String, dynamic>> verifyPhone({
    required String phone,
    required String otp,
  }) async {
    return post('/api/auth/verify-phone', body: {'phone': phone, 'otp': otp});
  }

  /// `POST /api/transaction/topup`
  Future<Map<String, dynamic>> submitTopUp({
    required String riderId,
    required double amount,
    required String method,
    String? upiRef,
    String? proofUrl,
    String purpose = 'TOP_UP',
  }) async {
    return post('/api/transaction/topup', body: {
      'riderId': riderId,
      'amount': amount,
      'method': method,
      'upiRef': upiRef,
      if (proofUrl != null) 'proofUrl': proofUrl,
      'purpose': purpose,
    });
  }

  /// `POST /api/upload` - Multipart file upload
  Future<String> uploadFile(File file, String type) async {
    if (VoltiumApp.isTestMode) {
      return 'https://mock-storage.voltium.in/test-upload-$type.png';
    }
    final uri = Uri.parse('$_baseUrl/api/upload');
    final request = http.MultipartRequest('POST', uri);

    final token = await SecureStorageService().getToken();
    if (token != null) {
      request.headers['Authorization'] = 'Bearer $token';
    }

    final stream = http.ByteStream(file.openRead());
    final length = await file.length();

    final multipartFile = http.MultipartFile(
      'file',
      stream,
      length,
      filename: file.path.split('/').last,
    );

    request.files.add(multipartFile);
    request.fields['type'] = type;

    final streamedResponse = await request.send().timeout(_timeout);
    final response = await http.Response.fromStream(streamedResponse);

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final json = jsonDecode(response.body);
      final data = json['data'] as Map<String, dynamic>?;
      final url = data?['url'] as String?;
      if (url == null) {
        throw ApiException(
          statusCode: response.statusCode,
          message: 'Upload response missing URL',
          code: 'UPLOAD_NO_URL',
        );
      }
      return url;
    } else {
      throw ApiException(
        statusCode: response.statusCode,
        message: 'Upload failed: ${response.body}',
        code: 'UPLOAD_FAILED',
      );
    }
  }

  /// `PUT /api/rider/profile` - Generic profile update
  Future<Map<String, dynamic>> updateProfile({
    required String riderId,
    Map<String, dynamic>? data,
  }) async {
    return put('/api/rider/profile', body: {
      'riderId': riderId,
      ...?data,
    });
  }

  /// `GET /api/rider/settings` - Fetch public settings (walletMinTopup, etc.)
  Future<Map<String, dynamic>> fetchSettings() async {
    return get('/api/rider/settings');
  }

  /// `GET /api/rider/offers` - Fetch active sponsored offers
  Future<Map<String, dynamic>> fetchSponsoredOffers() async {
    return get('/api/rider/offers');
  }

  /// `GET /api/rider/rewards` - Fetch rider rewards
  Future<Map<String, dynamic>> fetchRewards() async {
    return get('/api/rider/rewards');
  }

  /// `GET /api/rider/referrals` - Fetch rider referral data
  Future<Map<String, dynamic>> fetchReferrals() async {
    return get('/api/rider/referrals');
  }

  /// `GET /api/rider/dashboard` - Fetch dashboard data
  Future<Map<String, dynamic>> fetchDashboard() async {
    return get('/api/rider/dashboard');
  }

  /// `GET /api/support/tickets` - Fetch rider support tickets
  Future<Map<String, dynamic>> fetchTickets() async {
    return get('/api/support/tickets');
  }

  /// `GET /api/support/faqs` - Fetch active FAQs
  Future<Map<String, dynamic>> fetchFaqs() async {
    return get('/api/support/faqs');
  }

  /// `GET /api/rider/earnings` - Fetch rider earnings
  Future<Map<String, dynamic>> fetchEarnings() async {
    return get('/api/rider/earnings');
  }

  /// `POST /api/rider/earnings` - Create earning entry
  Future<Map<String, dynamic>> postEarning(Map<String, dynamic> data) async {
    return post('/api/rider/earnings', body: data);
  }

  /// `GET /api/vehicles?hubId=` - Fetch vehicles by hub
  Future<Map<String, dynamic>> fetchVehicles(String hubId) async {
    return get('/api/vehicles?hubId=$hubId');
  }

  /// `GET /api/shifts?hubId=&date=` - Fetch shifts by hub and date
  Future<Map<String, dynamic>> fetchShifts(String hubId, String date) async {
    return get('/api/shifts?hubId=$hubId&date=$date');
  }

  /// `GET /api/pricing?hubId=&basePrice=` - Fetch pricing
  Future<Map<String, dynamic>> fetchPricing(
      String hubId, double basePrice) async {
    return get('/api/pricing?hubId=$hubId&basePrice=$basePrice');
  }

  /// `POST /api/rider/sync/device-data` - Sync device telemetry
  Future<Map<String, dynamic>> syncDeviceData({
    required String type,
    required dynamic data,
  }) async {
    return post('/api/rider/sync/device-data', body: {
      'type': type,
      'data': data,
    });
  }

  /// `PUT /api/rider/profile` - Sync permission grant state
  Future<Map<String, dynamic>> syncPermissionState({
    required String riderId,
    required Map<String, dynamic> permissions,
  }) async {
    return updateProfile(riderId: riderId, data: permissions);
  }

  /// `POST /api/rider/sync/pickup` - Actually used for return in this logic or similar
  Future<Map<String, dynamic>> submitVehicleReturn({
    required String riderId,
    required List<String> photoUrls,
    String? reason,
  }) async {
    // For now, using a specialized endpoint or updating the rider status
    return updateProfile(
      riderId: riderId,
      data: {
        'returnPending': true,
        'submissionDate': DateTime.now().toIso8601String().split('T')[0],
        'returnPhotos': photoUrls,
        'returnReason': reason ?? 'End of rental',
      },
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Generic HTTP helpers with retry logic
  // ════════════════════════════════════════════════════════════════════════

  Future<Map<String, dynamic>> _fetchWithRetry(
      Future<http.Response> Function() call) async {
    int attempts = 0;
    Duration delay = _initialRetryDelay;

    while (true) {
      try {
        debugPrint('ApiService: Attempt ${attempts + 1}...');
        final response = await call();
        debugPrint('ApiService: Response status: ${response.statusCode}');
        MonitoringService.logInfo(
            'API Response: ${response.statusCode} for $attempts attempt(s)');
        return _processResponse(response);
      } on ApiException catch (e) {
        // Don't retry client errors (4xx)
        if (e.statusCode >= 400 && e.statusCode < 500) {
          rethrow;
        }

        attempts++;
        if (attempts >= _maxRetries) {
          debugPrint(
              'ApiService: Max retries reached after $_maxRetries attempts');
          rethrow;
        }

        debugPrint(
            'ApiService: Retry $attempts/$_maxRetries after ${delay.inMilliseconds}ms');
        MonitoringService.logInfo('API Retry: $attempts/$_maxRetries ($delay)');
        await Future.delayed(delay);
        delay *= 2; // Exponential backoff
      }
    }
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? queryParams,
  }) {
    return _executeWithRefresh(
        () => _getInternal(path, queryParams: queryParams));
  }

  Future<Map<String, dynamic>> _getInternal(
    String path, {
    Map<String, String>? queryParams,
  }) async {
    final stopwatch = Stopwatch()..start();
    final uri = _buildUri(path, queryParams);
    final headers = await _headers(method: 'GET', path: path);
    debugPrint('ApiService GET: $uri');
    try {
      final result = await _fetchWithRetry(
          () => http.get(uri, headers: headers).timeout(_timeout));
      stopwatch.stop();
      if (_responseInterceptor != null) {
        return await _responseInterceptor!(
            'GET', path, result, 200, stopwatch.elapsed);
      }
      return result;
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(
        statusCode: 0,
        message: 'Network error: ${e.toString()}',
        code: 'NETWORK_ERROR',
      );
    }
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
  }) {
    return _executeWithRefresh(() => _postInternal(path, body: body));
  }

  Future<Map<String, dynamic>> _postInternal(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final stopwatch = Stopwatch()..start();
    final uri = _buildUri(path);
    final headers = await _headers(method: 'POST', path: path);
    debugPrint('ApiService POST: $uri');
    try {
      final result = await _fetchWithRetry(() => http
          .post(uri, headers: headers, body: jsonEncode(body))
          .timeout(_timeout));
      stopwatch.stop();
      if (_responseInterceptor != null) {
        return await _responseInterceptor!(
            'POST', path, result, 200, stopwatch.elapsed);
      }
      return result;
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(
        statusCode: 0,
        message: 'Network error: ${e.toString()}',
        code: 'NETWORK_ERROR',
      );
    }
  }

  Future<Map<String, dynamic>> put(
    String path, {
    Map<String, dynamic>? body,
  }) {
    return _executeWithRefresh(() => _putInternal(path, body: body));
  }

  Future<Map<String, dynamic>> _putInternal(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final stopwatch = Stopwatch()..start();
    final uri = _buildUri(path);
    final headers = await _headers(method: 'PUT', path: path);
    debugPrint('ApiService PUT: $uri');
    try {
      final result = await _fetchWithRetry(() => http
          .put(uri, headers: headers, body: jsonEncode(body))
          .timeout(_timeout));
      stopwatch.stop();
      debugPrint('ApiService PUT success: $uri');
      if (_responseInterceptor != null) {
        return await _responseInterceptor!(
            'PUT', path, result, 200, stopwatch.elapsed);
      }
      return result;
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(
        statusCode: 0,
        message: 'Network error: ${e.toString()}',
        code: 'NETWORK_ERROR',
      );
    }
  }

  Future<Map<String, dynamic>> delete(
    String path, {
    Map<String, String>? queryParams,
  }) {
    return _executeWithRefresh(
        () => _deleteInternal(path, queryParams: queryParams));
  }

  Future<Map<String, dynamic>> _deleteInternal(
    String path, {
    Map<String, String>? queryParams,
  }) async {
    final stopwatch = Stopwatch()..start();
    final uri = _buildUri(path, queryParams);
    final headers = await _headers(method: 'DELETE', path: path);
    debugPrint('ApiService DELETE: $uri');
    try {
      final result = await _fetchWithRetry(
          () => http.delete(uri, headers: headers).timeout(_timeout));
      stopwatch.stop();
      if (_responseInterceptor != null) {
        return await _responseInterceptor!(
            'DELETE', path, result, 200, stopwatch.elapsed);
      }
      return result;
    } on ApiException {
      rethrow;
    } catch (e) {
      throw ApiException(
        statusCode: 0,
        message: 'Network error: ${e.toString()}',
        code: 'NETWORK_ERROR',
      );
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Internal helpers
  // ════════════════════════════════════════════════════════════════════════

  Uri _buildUri(String path, [Map<String, String>? queryParams]) {
    final uriStr = '$_baseUrl$path';
    if (queryParams == null || queryParams.isEmpty) {
      return Uri.parse(uriStr);
    }
    return Uri.parse(uriStr).replace(queryParameters: queryParams);
  }

  /// Parses a successful response body as JSON, or throws [ApiException].
  Map<String, dynamic> _processResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      try {
        final body = response.body.trim();
        if (body.isEmpty) {
          debugPrint('ApiService: Response body is empty');
          return {};
        }
        final decoded = jsonDecode(body);
        if (decoded is! Map<String, dynamic>) {
          debugPrint('ApiService: Response was not a Map: $decoded');
          return {};
        }
        return decoded;
      } catch (e) {
        debugPrint('ApiService: JSON Decode Error: $e');
        throw ApiException(
          statusCode: response.statusCode,
          message: 'Invalid JSON response: ${e.toString()}',
          code: 'PARSE_ERROR',
        );
      }
    }

    // Attempt to read the error body from the server.
    debugPrint('ApiService: Error Response Body: ${response.body}');
    String errorMessage = response.reasonPhrase ?? 'Unknown error';
    String? errorCode;

    try {
      final errorBody = jsonDecode(response.body) as Map<String, dynamic>;

      // Handle standardized { success: false, error: { code, message } } structure
      if (errorBody.containsKey('error') && errorBody['error'] is Map) {
        final errorObj = errorBody['error'] as Map<String, dynamic>;
        errorMessage = errorObj['message'] as String? ?? errorMessage;
        errorCode = errorObj['code'] as String?;
      } else {
        errorMessage = errorBody['message'] as String? ??
            errorBody['error'] as String? ??
            errorMessage;
        errorCode = errorBody['code'] as String?;
      }
    } catch (_) {
      // Response body was not valid JSON – fall back to HTTP reason phrase.
    }

    throw _handleError(response, message: errorMessage, code: errorCode);
  }

  /// Builds a structured [ApiException] from an HTTP response.
  ApiException _handleError(
    http.Response response, {
    String? message,
    String? code,
  }) {
    final status = response.statusCode;

    // Map common status codes to semantic error codes.
    final semanticCode = code ?? _semanticCodeForStatus(status);

    return ApiException(
      statusCode: status,
      message: message ?? 'Request failed with status $status',
      code: semanticCode,
    );
  }

  String _semanticCodeForStatus(int status) {
    switch (status) {
      case 400:
        return 'BAD_REQUEST';
      case 401:
        return 'UNAUTHORIZED';
      case 403:
        return 'FORBIDDEN';
      case 404:
        return 'NOT_FOUND';
      case 409:
        return 'CONFLICT';
      case 422:
        return 'VALIDATION_ERROR';
      case 429:
        return 'RATE_LIMITED';
      case 500:
        return 'INTERNAL_SERVER_ERROR';
      case 502:
        return 'BAD_GATEWAY';
      case 503:
        return 'SERVICE_UNAVAILABLE';
      default:
        return 'HTTP_$status';
    }
  }
}

/// Structured exception thrown by [ApiService] for all API-level failures.
///
/// ```dart
/// try {
///   final data = await api.fetchRiderProfile(phone: phone);
/// } on ApiException catch (e) {
///   debugPrint('${e.statusCode}: ${e.message} (${e.code})');
/// }
/// ```
class ApiException implements Exception {
  final int statusCode;
  final String message;
  final String? code;

  const ApiException({
    required this.statusCode,
    required this.message,
    this.code,
  });

  @override
  String toString() => 'ApiException($statusCode, $code): $message';
}
