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
import '../../config/app_config.dart';

/// Voltium API Client
///
/// Centralized HTTP client for all API calls.
/// Handles authentication, base URL, error parsing, and request signing.
class ApiClient {
  /// AUDIT FIX (workflows P0-D): the pinned client now enforces the API
  /// host on every handshake (trust-nothing mode). The expected host is
  /// derived lazily from the default base URL — a static initializer can't
  /// call [_defaultBaseUrl] because it may throw in misconfigured releases.
  /// T-99 follow-up (2026-08-23): the helper returns `String?` to handle
  /// test / misconfigured environments; the null host is passed through
  /// and PinnedHttpInterceptor accepts `null` to mean "don't pin"
  /// (development / unit tests). Production builds always have a value.
  static final http.Client _sharedHttpClient =
      PinnedHttpInterceptor.createClient(
          expectedHost: _pinnedHostFromDefaultBaseUrl() ?? '');

  /// Plain system-validated client for CROSS-ORIGIN hosts (signed-URL
  /// uploads to storage providers). Never carries the session token.
  static final http.Client _externalHttpClient =
      PinnedHttpInterceptor.createExternalClient();

  /// Best-effort host extraction that never throws (unlike
  /// [_defaultBaseUrl], which asserts on release misconfiguration).
  static String? _pinnedHostFromDefaultBaseUrl() {
    try {
      return Uri.parse(_defaultBaseUrl).host;
    } catch (_) {
      return null;
    }
  }

  static ApiClient? _sharedInstance;
  // PR-ONBOARDING-FLOW-2026-08-13: bumped the request timeout from
  // 10s to 30s. The hang-tight poll calls /api/rider/profile, and
  // the dev server occasionally takes 10-14s on cold-route compiles
  // or under load (we've seen up to 13.6s in the log). A 10s timeout
  // would cancel the call before the data arrived, leaving the rider
  // stuck on the hang-tight screen even after the admin approved
  // them. 30s is generous enough to absorb the slow tail while still
  // failing fast on a genuinely dead connection.
  static const Duration requestTimeout = Duration(seconds: 30);
  static const Duration uploadTimeout = Duration(seconds: 60);
  // PR-8 (F-055): dedicated timeout for signed-URL uploads to
  // S3/Cloud Storage. Longer than the regular multipart
  // `uploadTimeout` because the files are usually larger (KYC
  // selfies, Aadhaar/PAN scans, deposit photos) and the
  // signed-URL host is a different network path. The previous
  // code had two different timeouts (`uploadTimeout` 60s vs
  // `Duration(seconds: 120)` in `files_repository.dart`) which
  // silently drifted from each other.
  static const Duration signedUploadTimeout = Duration(seconds: 120);
  static const int shortRetryMaxAttempts = 3;
  static const Duration shortRetryBaseDelay = Duration(milliseconds: 200);
  static final Random _requestRandom = Random.secure();

  final http.Client _client;
  final SecureStorageService _storage;
  final String _baseUrl;

  String get baseUrl => _baseUrl;
  SecureStorageService get storage => _storage;

  /// Test seam (F-025 house pattern, mirrors `VoltiumApiService.instance`):
  /// lets widget tests substitute a fake transport for the singleton that
  /// the `ApiClient()` factory returns. Several call sites construct
  /// `ApiClient()` fresh (e.g. the pickup hub's OTP send), so tests must be
  /// able to replace the shared instance. Set to `null` in teardown.
  @visibleForTesting
  static set instanceForTest(ApiClient? client) {
    _sharedInstance = client;
    _isTestOverrideActive = client != null;
  }

  /// DEEP-AUDIT D-P1-3: tracks whether the test seam is currently in use,
  /// so the factory's StateError on custom-after-singleton can be skipped
  /// for legit test scenarios while still firing in production code.
  static bool _isTestOverrideActive = false;

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
      // DEEP-AUDIT D-P1-3 (2026-08-08): the previous `assert()` only
      // fired in debug/test — release builds silently let a second
      // instance through, with two SecureStorageService singletons
      // holding the same session_token. Token refresh on the wrong
      // instance logged the rider out unexpectedly. This is a real
      // check now (throws in release, debug, and test alike) unless the
      // test seam `instanceForTest` is actively in use.
      if (_sharedInstance != null && !_isTestOverrideActive) {
        throw StateError(
          'ApiClient: shared singleton already initialized. '
          'Creating a custom instance after the shared singleton is '
          'initialized can cause inconsistent auth state (two '
          'SecureStorageService instances holding the same '
          'session_token). Use the shared instance or call '
          'ApiClient.instanceForTest = null before constructing a custom '
          'instance.',
        );
      }
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

  /// Subclass hook for test fakes: a generative constructor that bypasses
  /// the singleton factory (a factory cannot be a `super()` target), so a
  /// fake transport can `extends ApiClient` and override `post`/`get`.
  /// Install the fake with [instanceForTest] before pumping.
  @visibleForTesting
  ApiClient.testOverride({
    http.Client? client,
    SecureStorageService? storage,
    String? baseUrl,
  })  : _client = client ?? _sharedHttpClient,
        _storage = storage ?? SecureStorageService(),
        _baseUrl = baseUrl ?? _defaultBaseUrl;

  static const configuredApiUrl = String.fromEnvironment('API_URL');

  static String get _defaultBaseUrl {
    // AUDIT FIX (workflows P1): enforce https in release. A plaintext
    // API_URL would ship bearer tokens over unencrypted HTTP.
    if (configuredApiUrl.isNotEmpty) {
      if (kReleaseMode) {
        final uri = Uri.tryParse(configuredApiUrl);
        if (uri == null || uri.scheme != 'https') {
          throw StateError(
            'API_URL must use https in release builds (got: $configuredApiUrl)',
          );
        }
      }
      return configuredApiUrl;
    }
    if (PlatformInfo.isWeb) return ''; // Relative URLs for same-origin routing
    if (kReleaseMode) {
      throw Exception('API_URL must be provided for release builds');
    }
    return 'http://${AppConfig.localDevHost}:8081';
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

  /// PR-4 (F-011 — 2026-08-22 deep audit): public accessor for a fresh
  /// UUID v4 idempotency key. Callers (top-up, end-rental, deposit
  /// providers) should pass a NEW key per user-initiated submit so
  /// the server can deduplicate retries. Reusing a key across
  /// different user actions would conflate the dedup window.
  static String newIdempotencyKey() {
    final rng = _requestRandom;
    final bytes = List<int>.generate(16, (_) => rng.nextInt(256));
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
          // Clear stale session credentials to prevent persistent 401 loops
          // on launch — but NOT the FCM command secret / device-lock state
          // (PR-VER-2026-08-06 AUTH P1-4: clearAll() wiped those, silently
          // disabling ADMIN_LOCK HMAC verification on the device).
          MonitoringService.logInfo(
              'ApiClient: refresh token explicitly rejected (${response.statusCode}), clearing session credentials');
          await _storage.clearSessionCredentials();
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
          final retriedHeaders = await _getHeaders();
          response = await request(retriedHeaders);
        }
        // Fall through: caller will see response and react.
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

  /// In-flight GET request deduplication: merges concurrent identical GET requests into a single Future.
  final Map<String, Future<Map<String, dynamic>>> _inFlightGets = {};

  /// GET request with in-flight single-flight deduplication
  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? queryParams,
    Future<void>? cancelSignal,
    bool noDedup = false,
  }) async {
    final uri =
        Uri.parse('$_baseUrl$path').replace(queryParameters: queryParams);
    final key = uri.toString();

    if (!noDedup) {
      final existing = _inFlightGets[key];
      if (existing != null) {
        // PR-8 (F-048 — 2026-08-22 deep audit): the previous
        // dedup branch silently dropped the caller's
        // `cancelSignal` — the cached `existing` future was
        // returned as-is, so a second caller could not cancel
        // their wait by re-issuing a request. Now wrap with
        // `Future.any` so the SECOND caller's cancel signal
        // fires even when they're sharing an in-flight
        // request. The first caller's request is unaffected
        // (the in-flight HTTP call continues).
        if (cancelSignal != null) {
          try {
            return await Future.any<dynamic>([
              existing,
              cancelSignal.then((_) {
                throw RequestCancelledException();
              }),
            ]);
          } on RequestCancelledException {
            rethrow;
          }
        }
        return existing;
      }
      final future = _executeGet(uri, path, cancelSignal);
      _inFlightGets[key] = future;
      try {
        return await future;
      } finally {
        _inFlightGets.remove(key);
      }
    }

    return _executeGet(uri, path, cancelSignal);
  }

  Future<Map<String, dynamic>> _executeGet(
    Uri uri,
    String path,
    Future<void>? cancelSignal,
  ) async {
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

  /// GET request with HTTP ETag / 304 conditional caching.
  /// Sends `If-None-Match: <etag>` and serves local SQLite cache if 304 is returned.
  Future<Map<String, dynamic>> getWithConditionalCache(
    String path, {
    Map<String, String>? queryParams,
    Future<void>? cancelSignal,
  }) async {
    final cacheKey = 'http_etag_$path';
    final offlineStorage = OfflineStorageService();
    final cached = await offlineStorage.getCachedData(cacheKey);
    final savedEtag = cached?['_etag'] as String?;
    final savedBody = cached?['data'] as Map<String, dynamic>?;

    final uri =
        Uri.parse('$_baseUrl$path').replace(queryParameters: queryParams);

    try {
      final headers = await _getHeaders();
      if (savedEtag != null && savedEtag.isNotEmpty) {
        headers['If-None-Match'] = savedEtag;
      }

      final response =
          await _client.get(uri, headers: headers).timeout(requestTimeout);

      if (response.statusCode == 304 && savedBody != null) {
        return savedBody;
      }

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final body = await _handleResponse(response);
        final newEtag = response.headers['etag'];
        if (newEtag != null && newEtag.isNotEmpty) {
          await offlineStorage.cacheData(cacheKey, {
            'data': body,
            '_etag': newEtag,
          });
        }
        return body;
      }

      return await _handleResponse(response);
    } catch (e) {
      if (savedBody != null) {
        return savedBody;
      }
      rethrow;
    }
  }

  /// POST request
  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    String? idempotencyKey,
    Future<void>? cancelSignal,
  }) async {
    final effectiveIdempotencyKey = idempotencyKey ?? newIdempotencyKey();
    final uri = Uri.parse('$_baseUrl$path');

    try {
      return await _executeWithRetry((headers) async {
        headers['Idempotency-Key'] = effectiveIdempotencyKey;
        return await _client
            .post(
              uri,
              headers: headers,
              body: body != null ? jsonEncode(body) : null,
            )
            .timeout(requestTimeout);
      }, cancelSignal: cancelSignal);
    } on SocketException catch (_) {
      await _maybeQueueOffline('POST', path, body, effectiveIdempotencyKey);
      rethrow;
    } on TimeoutException catch (_) {
      await _maybeQueueOffline('POST', path, body, effectiveIdempotencyKey);
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
    final effectiveIdempotencyKey = idempotencyKey ?? newIdempotencyKey();
    final uri =
        Uri.parse('$_baseUrl$path').replace(queryParameters: queryParams);

    try {
      return await _executeWithRetry((headers) async {
        headers['Idempotency-Key'] = effectiveIdempotencyKey;
        return await _client
            .put(
              uri,
              headers: headers,
              body: body != null ? jsonEncode(body) : null,
            )
            .timeout(requestTimeout);
      }, cancelSignal: cancelSignal);
    } on SocketException catch (_) {
      await _maybeQueueOffline('PUT', path, body, effectiveIdempotencyKey);
      rethrow;
    } on TimeoutException catch (_) {
      await _maybeQueueOffline('PUT', path, body, effectiveIdempotencyKey);
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
    final effectiveIdempotencyKey = idempotencyKey ?? newIdempotencyKey();
    final uri =
        Uri.parse('$_baseUrl$path').replace(queryParameters: queryParams);

    try {
      return await _executeWithRetry((headers) async {
        headers['Idempotency-Key'] = effectiveIdempotencyKey;
        return await _client
            .delete(uri, headers: headers)
            .timeout(requestTimeout);
      }, cancelSignal: cancelSignal);
    } on SocketException catch (_) {
      await _maybeQueueOffline('DELETE', path, null, effectiveIdempotencyKey);
      rethrow;
    } on TimeoutException catch (_) {
      await _maybeQueueOffline('DELETE', path, null, effectiveIdempotencyKey);
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
    Map<String, dynamic>? body, [
    String? idempotencyKey,
  ]) async {
    // Only queue mutating operations for replay
    if (method == 'GET') return;
    try {
      final key = idempotencyKey ?? newIdempotencyKey();
      final offlineStorage = OfflineStorageService();
      await offlineStorage.addPendingOperation(
        path,
        method,
        body,
        idempotencyKey: key,
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

  /// PR-3 (F-005 — 2026-08-22 deep audit): raw PUT to an absolute URI.
  /// Used for signed-URL file uploads (S3/Cloud Storage) where the
  /// destination host is intentionally different from the API host.
  ///
  /// Goes through the SAME pinned http.Client as the rest of the API,
  /// so the signed-URL host's TLS cert must be registered via
  /// [PinnedHttpInterceptor.setDynamicPins] before calling. The
  /// pre-PR-3 implementation in `FilesRepository.uploadFile` used
  /// `package:http` directly, bypassing both the pin check and the
  /// Auth header.
  ///
  /// Intentionally bypasses [_executeWithRetry]: S3-style signed URLs
  /// return plain 200 (not JSON) and a retry on 5xx risks double-uploading
  /// the same bytes. The caller (FilesRepository) owns its own retry
  /// policy.
  Future<http.Response> putRaw(
    Uri uri, {
    required List<int> body,
    String contentType = 'application/octet-stream',
    Duration? timeout,
  }) async {
    // AUDIT FIX (workflows P0-F): two changes.
    // 1. CROSS-ORIGIN routing: signed-URL uploads go to S3/GCS — they must
    //    NOT use the pinned API client (its trust-nothing callback rejects
    //    every non-API host). External hosts use the system-validated
    //    external client instead.
    final isSameOrigin = uri.host == Uri.tryParse(_baseUrl)?.host;
    final client = isSameOrigin ? _client : _externalHttpClient;
    // 2. TOKEN LEAK: the session bearer token was attached to whatever URI
    //    this method received, landing in storage-provider access logs.
    //    Signed URLs are pre-authorized — strip auth entirely for
    //    cross-origin uploads.
    final token = isSameOrigin ? await _storage.getSessionToken() : null;
    final headers = {
      'Content-Type': contentType,
      'Content-Length': body.length.toString(),
      'x-correlation-id': _newCorrelationId(),
      if (token != null) 'Authorization': 'Bearer $token',
    };
    return await client
        .put(uri, headers: headers, body: body)
        .timeout(timeout ?? uploadTimeout);
  }

  /// Handle API response, standardize errors.
  /// Large payloads (>50 KB) are JSON-decoded on a background isolate via
  /// [_safeJsonDecodeAsync] to keep the UI thread free during heavy parsing.
  Future<Map<String, dynamic>> _handleResponse(http.Response response) async {
    final decoded = await _safeJsonDecodeAsync(response.body);
    final body = decoded is Map<String, dynamic>
        ? decoded
        : (decoded == null ? <String, dynamic>{} : {'data': decoded});

    if (response.statusCode == 304) {
      return <String, dynamic>{'_status': 304, '_isNotModified': true};
    }

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
