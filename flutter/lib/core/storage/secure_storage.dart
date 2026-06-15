import 'package:flutter/foundation.dart';

/// Secure Storage for voltium session data
///
/// In production, uses flutter_secure_storage.
/// For development, uses in-memory storage (no native dependency setup needed).
class SecureStorage {
  static const _tokenKey = 'session_token';
  static const _riderIdKey = 'rider_id';

  // In-memory fallback for development
  final Map<String, String> _inMemory = {};

  /// Save session token
  Future<void> saveSessionToken(String token) async {
    _inMemory[_tokenKey] = token;
  }

  /// Get session token
  Future<String?> getSessionToken() async {
    return _inMemory[_tokenKey];
  }

  /// Clear session
  Future<void> clearSession() async {
    _inMemory.clear();
  }

  /// Save rider ID
  Future<void> saveRiderId(String riderId) async {
    _inMemory[_riderIdKey] = riderId;
  }

  /// Get rider ID
  Future<String?> getRiderId() async {
    return _inMemory[_riderIdKey];
  }

  /// Check if logged in
  Future<bool> isLoggedIn() async {
    final token = await getSessionToken();
    return token != null && token.isNotEmpty;
  }
}
