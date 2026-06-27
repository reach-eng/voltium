import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../../services/secure_storage_service.dart';
import '../../services/offline_storage_service.dart';
import '../platform/platform_info.dart';
import 'pinned_http_client.dart';

/// Voltium API Client
///
/// Centralized HTTP client for all API calls.
/// Handles authentication, base URL, error parsing, and request signing.
class ApiClient {
  static final http.Client _sharedHttpClient = PinnedHttpInterceptor.createClient();
  static ApiClient? _sharedInstance;
  static const Duration requestTimeout = Duration(seconds: 30);
  static final Random _requestRandom = Random.secure();

  final http.Client _client;
  final SecureStorageService _storage;
  final String _baseUrl;

  String get baseUrl => _baseUrl;
  SecureStorageService get storage => _storage;

  factory ApiClient({
    http.Client? client,
    SecureStorageService? storage,
    String? baseUrl,
  }) {
    if (client != null || storage != null || baseUrl != null) {
      return ApiClient._(
        client: client ?? _sharedHttpClient,
        storage: storage ?? SecureStorageService(),
        baseUrl: baseUrl ?? _defaultBaseUrl,
      );
    }

    return _sharedInstance ??= ApiClient._(
      client: _sharedHttpClient,
      storage: SecureStorageService(),
      baseUrl: _defaultBaseUrl,
    );
  }

  ApiClient._({
    required http.Client client,
    required SecureStorageService storage,
    required String baseUrl,
  })  : _client = client,
         _storage = storage,
         _baseUrl = baseUrl;

  static const configuredApiUrl = String.fromEnvironment('API_URL');

  static String get _defaultBaseUrl {
    if (PlatformInfo.isWeb) return ''; // Relative URLs for same-origin routing
    if (configuredApiUrl.isNotEmpty) return configuredApiUrl;
    if (kReleaseMode) {
      throw Exception('API_URL must be provided for release builds');
    }
    return 'http://localhost:8081';
  }

  /// Get auth headers with session token
  Future<Map<String, String>> _getHeaders() async {
    if (PlatformInfo.isWeb) {
      return {
        'Content-Type': 'application/json',
        'x-correlation-id': _newCorrelationId(),
      };
    }
    final token = await _storage.getSessionToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
      'x-correlation-id': _newCorrelationId(),
    };
  }

  /// Generates a cryptographically random UUID v4 (RFC 4122) for request tracing.
  String _newCorrelationId() {
    final rng = _requestRandom;
    final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
    // Set version (4) and variant bits per RFC 4122
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}'
        '-${hex.substring(12, 16)}-${hex.substring(16, 20)}'
        '-${hex.substring(20, 32)}';
  }

  /// GET request
  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? queryParams,
  }) async {
    final uri =
        Uri.parse('$_baseUrl$path').replace(queryParameters: queryParams);
    final headers = await _getHeaders();
    try {
      final response =
          await _client.get(uri, headers: headers).timeout(requestTimeout);
      return _handleResponse(response);
    } on SocketException catch (_) {
      await _maybeQueueOffline('GET', path, null);
      rethrow;
    } on TimeoutException catch (_) {
      await _maybeQueueOffline('GET', path, null);
      rethrow;
    }
  }

  /// POST request
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    String? idempotencyKey,
  }) async {
    final uri = Uri.parse('$_baseUrl$path');
    final headers = await _getHeaders();
    if (idempotencyKey != null) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    try {
      final response = await _client
          .post(
            uri,
            headers: headers,
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(requestTimeout);
      return _handleResponse(response);
    } on SocketException catch (_) {
      await _maybeQueueOffline('POST', path, body);
      rethrow;
    } on TimeoutException catch (_) {
      await _maybeQueueOffline('POST', path, body);
      rethrow;
    }
  }

  /// PUT request
  Future<Map<String, dynamic>> put(
    String path, {
    Map<String, dynamic>? body,
    String? idempotencyKey,
  }) async {
    final uri = Uri.parse('$_baseUrl$path');
    final headers = await _getHeaders();
    if (idempotencyKey != null) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    try {
      final response = await _client
          .put(
            uri,
            headers: headers,
            body: body != null ? jsonEncode(body) : null,
          )
          .timeout(requestTimeout);
      return _handleResponse(response);
    } on SocketException catch (_) {
      await _maybeQueueOffline('PUT', path, body);
      rethrow;
    } on TimeoutException catch (_) {
      await _maybeQueueOffline('PUT', path, body);
      rethrow;
    }
  }

  /// DELETE request
  Future<Map<String, dynamic>> delete(String path, {String? idempotencyKey}) async {
    final uri = Uri.parse('$_baseUrl$path');
    final headers = await _getHeaders();
    if (idempotencyKey != null) {
      headers['Idempotency-Key'] = idempotencyKey;
    }
    try {
      final response =
          await _client.delete(uri, headers: headers).timeout(requestTimeout);
      return _handleResponse(response);
    } on SocketException catch (_) {
      await _maybeQueueOffline('DELETE', path, null);
      rethrow;
    } on TimeoutException catch (_) {
      await _maybeQueueOffline('DELETE', path, null);
      rethrow;
    }
  }

  /// Send a previously queued offline request (used by connectivity flush).
  /// If [idempotencyKey] is provided, it is sent as the `Idempotency-Key` header
  /// so the server can deduplicate replay of mutating operations.
  Future<Map<String, dynamic>> sendQueuedRequest(
    String method,
    String path,
    Map<String, dynamic>? body, {
    String? idempotencyKey,
  }) async {
    switch (method.toUpperCase()) {
      case 'GET':
        return get(path);
      case 'POST':
        return post(path, body: body, idempotencyKey: idempotencyKey);
      case 'PUT':
        return put(path, body: body, idempotencyKey: idempotencyKey);
      case 'DELETE':
        return delete(path, idempotencyKey: idempotencyKey);
      default:
        return post(path, body: body, idempotencyKey: idempotencyKey);
    }
  }

  /// Queue an idempotent write offline when the network is unavailable.
  /// Only queues mutating operations (POST, PUT, DELETE).
  Future<void> _maybeQueueOffline(
    String method,
    String path,
    Map<String, dynamic>? body,
  ) async {
    // Only queue mutating operations for replay
    if (method == 'GET') return;
    try {
      final idempotencyKey = _newCorrelationId();
      final offlineStorage = OfflineStorageService();
      await offlineStorage.addPendingOperation(
        path, method, body,
        idempotencyKey: idempotencyKey,
      );
    } catch (_) {
      // Offline storage is optional — silently ignore failures
    }
  }

  /// Upload a file via multipart POST
  Future<Map<String, dynamic>> uploadFile(
    String path,
    File file, {
    String fieldName = 'file',
  }) async {
    final uri = Uri.parse('$_baseUrl$path');
    final headers = await _getHeaders();
    final request = http.MultipartRequest('POST', uri);

    request.headers.addAll(headers);
    request.files.add(await http.MultipartFile.fromPath(fieldName, file.path));

    final streamedResponse =
        await _client.send(request).timeout(requestTimeout);
    final response = await http.Response.fromStream(streamedResponse);
    return _handleResponse(response);
  }

  /// Handle API response, standardize errors
  Map<String, dynamic> _handleResponse(http.Response response) {
    final body = jsonDecode(response.body) as Map<String, dynamic>;

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (body['success'] == true) {
        return body['data'] as Map<String, dynamic>;
      }
      return body;
    }

    final error = body['error'] as Map<String, dynamic>?;
    final message = error?['message'] as String? ?? 'Unknown error';
    final code = error?['code'] as String? ?? body['code'] as String?;
    throw ApiException(
      message,
      response.statusCode,
      code: code,
      response: body,
    );
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  final String? code;
  final Map<String, dynamic>? response;

  ApiException(this.message, this.statusCode, {this.code, this.response});

  @override
  String toString() => 'ApiException($statusCode, $code): $message';
}
