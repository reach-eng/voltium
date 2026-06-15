import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../storage/secure_storage.dart';

/// Voltium API Client
///
/// Centralized HTTP client for all API calls.
/// Handles authentication, base URL, error parsing, and request signing.
class ApiClient {
  final http.Client _client;
  final SecureStorage _storage;
  final String _baseUrl;

  String get baseUrl => _baseUrl;
  SecureStorage get storage => _storage;

  ApiClient({
    http.Client? client,
    SecureStorage? storage,
    String? baseUrl,
  })  : _client = client ?? http.Client(),
        _storage = storage ?? SecureStorage(),
        _baseUrl = baseUrl ?? _defaultBaseUrl;

  static String get _defaultBaseUrl {
    if (kReleaseMode) {
      return 'https://api.voltium.app';
    }
    return 'http://localhost:8081';
  }

  /// Get auth headers with session token
  Future<Map<String, String>> _getHeaders() async {
    final token = await _storage.getSessionToken();
    return {
      'Content-Type': 'application/json',
      if (token != null) 'Authorization': 'Bearer $token',
      'x-correlation-id': DateTime.now().millisecondsSinceEpoch.toString(),
    };
  }

  /// GET request
  Future<Map<String, dynamic>> get(String path, {Map<String, String>? queryParams}) async {
    final uri = Uri.parse('$_baseUrl$path').replace(queryParameters: queryParams);
    final headers = await _getHeaders();
    final response = await _client.get(uri, headers: headers);
    return _handleResponse(response);
  }

  /// POST request
  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$_baseUrl$path');
    final headers = await _getHeaders();
    final response = await _client.post(
      uri,
      headers: headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  /// PUT request
  Future<Map<String, dynamic>> put(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$_baseUrl$path');
    final headers = await _getHeaders();
    final response = await _client.put(
      uri,
      headers: headers,
      body: body != null ? jsonEncode(body) : null,
    );
    return _handleResponse(response);
  }

  /// DELETE request
  Future<Map<String, dynamic>> delete(String path) async {
    final uri = Uri.parse('$_baseUrl$path');
    final headers = await _getHeaders();
    final response = await _client.delete(uri, headers: headers);
    return _handleResponse(response);
  }

  /// Upload a file via multipart POST
  Future<Map<String, dynamic>> uploadFile(String path, File file, {String fieldName = 'file'}) async {
    final uri = Uri.parse('$_baseUrl$path');
    final headers = await _getHeaders();
    final request = http.MultipartRequest('POST', uri);

    request.headers.addAll(headers);
    request.files.add(await http.MultipartFile.fromPath(fieldName, file.path));

    final streamedResponse = await _client.send(request);
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
    throw ApiException(message, response.statusCode, code: code, response: body);
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
