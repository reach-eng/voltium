import 'dart:async';
import 'dart:convert';
import 'package:universal_io/io.dart';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../../services/secure_storage_service.dart';
import '../../services/offline_storage_service.dart';
import '../../services/cache_service.dart';
import '../../services/monitoring_service.dart';
import '../platform/platform_info.dart';
import 'pinned_http_client.dart';

/// Voltium API Client
///
/// Centralized HTTP client for all API calls.
/// Handles authentication, base URL, error parsing, and request signing.
class ApiClient {
  static final http.Client _sharedHttpClient =
      PinnedHttpInterceptor.createClient();
  static ApiClient? _sharedInstance;
  static const Duration requestTimeout = Duration(seconds: 10);
  static const Duration uploadTimeout = Duration(seconds: 60);
  static const int shortRetryMaxAttempts = kDebugMode ? 1 : 3;
  static const Duration shortRetryBaseDelay = Duration(milliseconds: 200);
  static final Random _requestRandom = Random.secure();

  final http.Client _client;
  final SecureStorageService _storage;
  final String _baseUrl;

  String get baseUrl => _baseUrl;
  SecureStorageService get storage => _storage;

  /// Single-flight guard for token refresh. While a refresh is in progress,
  /// concurrent 401-handlers `_await` this Future instead of issuing their
  /// own refresh call, so we never rotate the refresh token out from under
  /// in-flight requests (F-019).
  Future<bool>? _refreshInFlight;

  factory ApiClient({
    http.Client? client,
    SecureStorageService? storage,
    String? baseUrl,
  }) {
    if (client != null || storage != null || baseUrl != null) {
      assert(
        _sharedInstance == null,
        'ApiClient: creating a custom instance after the shared singleton was '
        'initialized. This may cause inconsistent auth state. Use the shared '
        'instance or create custom instances before the first ApiClient() call.',
      );
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
    if (configuredApiUrl.isNotEmpty) return configuredApiUrl;
    if (PlatformInfo.isWeb) return ''; // Relative URLs for same-origin routing
    if (kReleaseMode) {
      throw Exception('API_URL must be provided for release builds');
    }
    return 'http://127.0.0.1:8081';
  }

  /// Get auth headers with session token
  Future<Map<String, String>> _getHeaders() async {
    if (PlatformInfo.isWeb) {
      return {
        'Content-Type': 'application/json',
        'Connection': 'keep-alive',
        'x-correlation-id': _newCorrelationId(),
      };
    }
    final token = await _storage.getSessionToken();
    return {
      'Content-Type': 'application/json',
      'Connection': 'keep-alive',
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

  /// Performs a single token refresh. Concurrent callers receive the same
  /// in-flight Future via [_refreshInFlight] rather than racing each other.
  /// On refresh failure we explicitly do NOT call `_storage.clearAll()`;
  /// clearing the refresh token would log the user out as a side-effect of
  /// one transient failed request (F-019).
  Future<bool> _refreshToken() async {
    final pending = _refreshInFlight;
    if (pending != null) return pending;

    final completer = Completer<bool>();
    _refreshInFlight = completer.future;
    try {
      final refreshToken = await _storage.getRefreshToken();
      if (refreshToken == null) {
        completer.complete(false);
        return completer.future;
      }

      try {
        final uri = Uri.parse('$_baseUrl/api/auth/refresh');
        final headers = {
          'Content-Type': 'application/json',
          'x-correlation-id': _newCorrelationId(),
        };

        final response = await _client
            .post(
              uri,
              headers: headers,
              body: jsonEncode({'refreshToken': refreshToken}),
            )
            .timeout(requestTimeout);

        if (response.statusCode >= 200 && response.statusCode < 300) {
          final body = _safeJsonDecode(response.body);
          if (body is Map<String, dynamic> && body['success'] == true) {
            final data = body['data'];
            if (data is Map<String, dynamic>) {
              final token = data['token'] as String?;
              if (token == null || token.isEmpty) {
                completer.complete(false);
                return completer.future;
              }
              await _storage.saveSessionToken(token);
              final newRefresh = data['refreshToken'] as String?;
              if (newRefresh != null && newRefresh.isNotEmpty) {
                await _storage.setRefreshToken(newRefresh);
              }
              completer.complete(true);
              return completer.future;
            }
          }
        } else if (response.statusCode == 401 || response.statusCode == 403) {
          // Explicit token rejection (revoked or expired refresh token).
          // Clear stale credentials to prevent persistent 401 loops on launch.
          MonitoringService.logInfo(
              'ApiClient: refresh token explicitly rejected (${response.statusCode}), clearing credentials');
          await _storage.clearAll();
        }
      } catch (e, stack) {
        MonitoringService.logError(e, stack,
            reason: 'ApiClient: refresh failed');
      }

      completer.complete(false);
      return completer.future;
    } finally {
      _refreshInFlight = null;
    }
  }

  /// Safely decode a JSON body, returning `null` on parse failure rather
  /// than throwing an unhandled `FormatException` (F-019).
  static dynamic _safeJsonDecode(String body) {
    if (body.isEmpty) return null;
    try {
      return jsonDecode(body);
    } on FormatException catch (e) {
      MonitoringService.logInfo('ApiClient: non-JSON response body: $e');
      return null;
    }
  }

  /// Top-level-equivalent static function required by [compute] — must not
  /// be a closure or instance method.
  static dynamic _decodeJsonOnIsolate(String body) {
    if (body.isEmpty) return null;
    try {
      return jsonDecode(body);
    } on FormatException {
      return null;
    }
  }

  /// Decodes [body] on a background isolate when the payload exceeds 50 KB,
  /// preventing frame drops on large list responses (transactions, riders).
  /// Small payloads are decoded inline to avoid isolate-spawn overhead.
  static Future<dynamic> _safeJsonDecodeAsync(String body) async {
    if (body.isEmpty) return null;
    if (body.length > 51200) {
      return compute(_decodeJsonOnIsolate, body);
    }
    return _safeJsonDecode(body);
  }

  /// Executes a request with full retry reliability:
  /// - Single-flight token refresh on 401
  /// - Transient retry: timeouts / 5xx / network errors get exponential
  ///   backoff up to [shortRetryMaxAttempts].
  ///
  /// On 401 for non-web clients the refresh token is kept; if refresh
  /// ultimately fails we return a 401 to the caller instead of wiping
  /// stored credentials.
  Future<Map<String, dynamic>> _executeWithRetry(
    Future<http.Response> Function(Map<String, String> headers) request, {
    Future<void>? cancelSignal,
  }) async {
    for (var attempt = 0; attempt < shortRetryMaxAttempts; attempt++) {
      final headers = await _getHeaders();
      http.Response response;
      try {
        if (cancelSignal != null) {
          final res = await Future.any<dynamic>([
            request(headers),
            cancelSignal.then((_) => throw RequestCancelledException()),
          ]);
          response = res as http.Response;
        } else {
          response = await request(headers);
        }
      } on TimeoutException {
        if (attempt < shortRetryMaxAttempts - 1) {
          await _backoffBeforeRetry(attempt);
          continue;
        }
        rethrow;
      } on SocketException {
        if (attempt < shortRetryMaxAttempts - 1) {
          await _backoffBeforeRetry(attempt);
          continue;
        }
        rethrow;
      }

      // 401: only try once to refresh, on non-web. Refresh failures do
      // not destroy stored credentials.
      if (response.statusCode == 401 && !PlatformInfo.isWeb && attempt == 0) {
        final refreshed = await _refreshToken();
        if (refreshed) {
          continue; // re-issue with new headers
        }
        // Fall through: caller will see the 401 and can react.
      } else if (response.statusCode >= 500 &&
          attempt < shortRetryMaxAttempts - 1) {
        await _backoffBeforeRetry(attempt);
        continue;
      }

      return _handleResponse(response);
    }
    // Unreachable; loop exits via return above.
    throw StateError('ApiClient: retry loop exited unexpectedly');
  }

  /// Exponential backoff with a small jitter to avoid synchronised retries
  /// from a fleet of clients hitting a recovering server.
  Future<void> _backoffBeforeRetry(int attempt) async {
    final base = shortRetryBaseDelay.inMilliseconds * (1 << attempt);
    final jittered =
        Random().nextInt(shortRetryBaseDelay.inMilliseconds).toDouble();
    await Future<void>.delayed(
      Duration(milliseconds: base + jittered.toInt()),
    );
  }

  /// GET request
  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? queryParams,
    Future<void>? cancelSignal,
  }) async {
    final uri =
        Uri.parse('$_baseUrl$path').replace(queryParameters: queryParams);

    try {
      return await _executeWithRetry(
        (headers) => _client.get(uri, headers: headers).timeout(requestTimeout),
        cancelSignal: cancelSignal,
      );
    } on SocketException catch (_) {
      await _maybeQueueOffline('GET', path, null);
      rethrow;
    } on TimeoutException catch (_) {
      await _maybeQueueOffline('GET', path, null);
      rethrow;
    }
  }

  /// GET request with Stale-While-Revalidate (SWR) (Phase 2)
  /// Returns cached local response instantly if available, while fetching fresh data in background.
  Future<Map<String, dynamic>> getWithSWR(
    String path, {
    Map<String, String>? queryParams,
    Future<void>? cancelSignal,
  }) async {
    final cacheService = CacheService();
    final cached = cacheService.getCachedApiResponse(path);

    if (cached != null) {
      unawaited(
        get(path, queryParams: queryParams, cancelSignal: cancelSignal)
            .then((fresh) => cacheService.cacheApiResponse(path, fresh))
            .catchError((_) {}),
      );
      return cached;
    }

    final fresh =
        await get(path, queryParams: queryParams, cancelSignal: cancelSignal);
    await cacheService.cacheApiResponse(path, fresh);
    return fresh;
  }

  /// POST request
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    String? idempotencyKey,
    Future<void>? cancelSignal,
  }) async {
    final uri = Uri.parse('$_baseUrl$path');

    try {
      return await _executeWithRetry((headers) async {
        if (idempotencyKey != null) {
          headers['Idempotency-Key'] = idempotencyKey;
        }
        return await _client
            .post(
              uri,
              headers: headers,
              body: body != null ? jsonEncode(body) : null,
            )
            .timeout(requestTimeout);
      }, cancelSignal: cancelSignal);
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
    Map<String, String>? queryParams,
    Future<void>? cancelSignal,
  }) async {
    final uri =
        Uri.parse('$_baseUrl$path').replace(queryParameters: queryParams);

    try {
      return await _executeWithRetry((headers) async {
        if (idempotencyKey != null) {
          headers['Idempotency-Key'] = idempotencyKey;
        }
        return await _client
            .put(
              uri,
              headers: headers,
              body: body != null ? jsonEncode(body) : null,
            )
            .timeout(requestTimeout);
      }, cancelSignal: cancelSignal);
    } on SocketException catch (_) {
      await _maybeQueueOffline('PUT', path, body);
      rethrow;
    } on TimeoutException catch (_) {
      await _maybeQueueOffline('PUT', path, body);
      rethrow;
    }
  }

  /// DELETE request
  Future<Map<String, dynamic>> delete(
    String path, {
    String? idempotencyKey,
    Map<String, String>? queryParams,
    Future<void>? cancelSignal,
  }) async {
    final uri =
        Uri.parse('$_baseUrl$path').replace(queryParameters: queryParams);

    try {
      return await _executeWithRetry((headers) async {
        if (idempotencyKey != null) {
          headers['Idempotency-Key'] = idempotencyKey;
        }
        return await _client
            .delete(uri, headers: headers)
            .timeout(requestTimeout);
      }, cancelSignal: cancelSignal);
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
        path,
        method,
        body,
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

    return await _executeWithRetry((headers) async {
      final request = http.MultipartRequest('POST', uri);
      request.headers.addAll(headers);
      request.files
          .add(await http.MultipartFile.fromPath(fieldName, file.path));

      final streamedResponse =
          await _client.send(request).timeout(uploadTimeout);
      return await http.Response.fromStream(streamedResponse);
    });
  }

  /// Handle API response, standardize errors.
  /// Large payloads (>50 KB) are JSON-decoded on a background isolate via
  /// [_safeJsonDecodeAsync] to keep the UI thread free during heavy parsing.
  Future<Map<String, dynamic>> _handleResponse(http.Response response) async {
    final decoded = await _safeJsonDecodeAsync(response.body);
    final body = decoded is Map<String, dynamic>
        ? decoded
        : (decoded == null ? <String, dynamic>{} : {'data': decoded});

    if (response.statusCode >= 200 && response.statusCode < 300) {
      if (body['success'] == true) {
        final data = body['data'];
        if (data is Map<String, dynamic>) {
          return data;
        }
        return body;
      }
      return body;
    }

    final error = body['error'] as Map<String, dynamic>?;
    final message = error?['message'] as String? ??
        (response.statusCode >= 500
            ? 'Server error (${response.statusCode}). Please try again.'
            : 'Unknown error');
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

class RequestCancelledException implements Exception {
  final String message;
  RequestCancelledException([this.message = 'Request was cancelled']);

  @override
  String toString() => 'RequestCancelledException: $message';
}
