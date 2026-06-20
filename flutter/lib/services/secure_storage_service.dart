import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecureStorageService {
  static final SecureStorageService _instance =
      SecureStorageService._internal();
  factory SecureStorageService() => _instance;
  SecureStorageService._internal();

  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  static const String _keyToken = 'auth_token';
  static const String _keySessionToken = 'session_token';
  static const String _keyRefreshToken = 'refresh_token';
  static const String _keyPhone = 'user_phone';
  static const String _keyRiderId = 'rider_id';

  Future<void> setToken(String token) async {
    await _storage.write(key: _keyToken, value: token);
    await _storage.write(key: _keySessionToken, value: token);
  }

  Future<String?> getToken() async {
    return await _storage.read(key: _keyToken) ??
        await _storage.read(key: _keySessionToken);
  }

  Future<void> saveSessionToken(String token) => setToken(token);

  Future<String?> getSessionToken() => getToken();

  Future<void> setRefreshToken(String token) async {
    await _storage.write(key: _keyRefreshToken, value: token);
  }

  Future<String?> getRefreshToken() async {
    return await _storage.read(key: _keyRefreshToken);
  }

  Future<void> setPhone(String phone) async {
    await _storage.write(key: _keyPhone, value: phone);
  }

  Future<String?> getPhone() async {
    return await _storage.read(key: _keyPhone);
  }

  Future<void> writeValue(String key, String value) async {
    await _storage.write(key: key, value: value);
  }

  Future<String?> readValue(String key) async {
    return await _storage.read(key: key);
  }

  Future<void> saveRiderId(String riderId) async {
    await _storage.write(key: _keyRiderId, value: riderId);
  }

  Future<String?> getRiderId() async {
    return await _storage.read(key: _keyRiderId);
  }

  Future<void> clearAll() async {
    await _storage.deleteAll();
  }

  Future<void> clearSession() => clearAll();

  Future<bool> hasToken() async {
    final token = await getToken();
    return token != null && token.isNotEmpty;
  }

  Future<bool> isLoggedIn() => hasToken();

  static const String _kFcmCommandSecret = 'fcm_command_secret';
  static const String _keyDeviceLocked = 'device_locked_by_admin';

  Future<void> writeFcmCommandSecret(String secret) async {
    await _storage.write(key: _kFcmCommandSecret, value: secret);
  }

  Future<String?> readFcmCommandSecret() async {
    return await _storage.read(key: _kFcmCommandSecret);
  }

  Future<void> setDeviceLocked(bool locked) async {
    await _storage.write(key: _keyDeviceLocked, value: locked ? 'true' : 'false');
  }

  Future<bool> getDeviceLocked() async {
    final val = await _storage.read(key: _keyDeviceLocked);
    return val == 'true';
  }
}

class EncryptedCacheService {
  static final EncryptedCacheService _instance =
      EncryptedCacheService._internal();
  factory EncryptedCacheService() => _instance;
  EncryptedCacheService._internal();

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<void> write(String key, Map<String, dynamic> data) async {
    final jsonString = jsonEncode(data);
    await _storage.write(key: key, value: jsonString);
  }

  Future<Map<String, dynamic>?> read(String key) async {
    final jsonString = await _storage.read(key: key);
    if (jsonString == null) return null;
    return jsonDecode(jsonString) as Map<String, dynamic>;
  }

  Future<void> delete(String key) async {
    await _storage.delete(key: key);
  }

  Future<void> clear() async {
    await _storage.deleteAll();
  }
}
