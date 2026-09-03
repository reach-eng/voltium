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

  /// Canonical session-token storage key. All reads and writes for the
  /// rider's auth token go through this single key.
  ///
  /// PR-93 (RA-F-5, 2026-08-04): collapsed the previously-dual-key storage
  /// (`auth_token` + `session_token`) into a single key. The old
  /// `session_token` key is now only read by [getToken] once, on the
  /// first access after the upgrade, as part of a one-time migration.
  static const String _keyToken = 'auth_token';

  /// @deprecated Pre-RA-F-5 legacy key. Read once by [getToken] to migrate
  /// any value the previous app version wrote here into [_keyToken], then
  /// deleted. New code must not write to this key.
  static const String _keySessionToken = 'session_token';

  /// Tracks whether the one-time [getToken] migration has already run for
  /// the lifetime of this isolate. After the first migration attempt the
  /// flag is set, so the same key is never re-scanned on every call.
  bool _sessionTokenMigrationDone = false;

  static const String _keyRefreshToken = 'refresh_token';
  static const String _keyPhone = 'user_phone';
  static const String _keyRiderId = 'rider_id';

  Future<void> setToken(String token) async {
    await _storage.write(key: _keyToken, value: token);
  }

  /// Returns the canonical session token, performing a one-time migration
  /// from the legacy `session_token` key on first access.
  ///
  /// Migration rules (PR-93 / RA-F-5):
  ///   1. If [_keyToken] has a value, return it.
  ///   2. Else, if the legacy [_keySessionToken] has a value, copy it into
  ///      [_keyToken] and delete the legacy key. Return the migrated value.
  ///   3. Else, return null.
  ///
  /// The migration is attempted at most once per process; after that the
  /// legacy key is never read again.
  Future<String?> getToken() async {
    final primary = await _storage.read(key: _keyToken);
    if (primary != null) return primary;

    if (!_sessionTokenMigrationDone) {
      _sessionTokenMigrationDone = true;
      final legacy = await _storage.read(key: _keySessionToken);
      if (legacy != null && legacy.isNotEmpty) {
        await _storage.write(key: _keyToken, value: legacy);
        await _storage.delete(key: _keySessionToken);
        return legacy;
      }
    }

    return null;
  }

  Future<void> saveSessionToken(String token) => setToken(token);

  Future<String?> getSessionToken() => getToken();

  Future<void> setRefreshToken(String token) async {
    await _storage.write(key: _keyRefreshToken, value: token);
  }

  Future<String?> getRefreshToken() async {
    return await _storage.read(key: _keyRefreshToken);
  }

  /// DEEP-AUDIT D-P1-6 (2026-08-08): delete the persisted refresh
  /// token without touching other session keys (auth_token, phone,
  /// riderId) or device-level values (fcm_command_secret,
  /// device_locked_by_admin). Used by AuthRepository.forgetRefreshToken
  /// when the network logout call fails.
  Future<void> deleteRefreshToken() async {
    await _storage.delete(key: _keyRefreshToken);
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

  /// ⚠️ PR-12 (2026-08-21) — DANGEROUS. Wipes EVERY key in secure
  /// storage, including the FCM command secret and the device-lock
  /// state. Callers MUST justify the full wipe in a comment (see
  /// grep audit below).
  ///
  /// Audit (2026-08-21): the only callers of this method in the
  /// current codebase are the test harness (`test_helpers.dart`) and
  /// a few dead-code paths in legacy test fixtures. No production
  /// code path — not logout, not refresh-token rejection, not
  /// session-expiry — invokes [clearAll]. Logout + refresh failure
  /// both go through [clearSessionCredentials] which preserves the
  /// device-level keys (FCM secret, lock state).
  ///
  /// DO NOT introduce new [clearAll] callers in production. If you
  /// think you need it, you almost certainly want
  /// [clearSessionCredentials] instead. The grep one-liner to
  /// verify no new call site was added:
  ///
  ///   grep -rn "SecureStorageService().clearAll\b" lib/ test/
  Future<void> clearAll() async {
    await _storage.deleteAll();
  }

  /// PR-VER-2026-08-06 (AUTH P1-4): wipe the session credentials ONLY.
  /// `clearAll()`/`clearSession()` blow away `fcm_command_secret` and
  /// `device_locked_by_admin` too — a refresh-token rejection on a transient
  /// 401 then silently disabled ADMIN_LOCK verification on the device.
  /// These device-level values are deliberately preserved here.
  ///
  /// The "preserved on logout" set (the keys NOT touched by this
  /// method) is:
  ///   - `fcm_command_secret` — needed to HMAC-verify incoming
  ///     `SECURITY_COMMAND` FCM messages (ADMIN_LOCK, FORCE_UPDATE,
  ///     etc.). The HMAC secret is device-bound, not rider-bound;
  ///     wiping it on rider logout would force the next rider to
  ///     re-enroll on a fresh device, which the API does not
  ///     support.
  ///   - `device_locked_by_admin` — read by
  ///     `DevicePolicyProvider._initLockState` on every cold start.
  ///     A stale "true" from the previous rider is what keeps the
  ///     kiosk mode active; clearing it would let the next rider
  ///     open the app before an admin unlocks the device.
  ///   - any other device-bound key added in the future.
  ///
  /// To add a new preserved key, add the `key:` argument to the
  /// `_storage.delete(...)` list here AND update the audit
  /// `flutter/docs/TELEMETRY.md` (PR-12 says the only keys that
  /// must survive logout are the FCM secret + device lock state).
  Future<void> clearSessionCredentials() async {
    await _storage.delete(key: _keyToken);
    await _storage.delete(key: _keySessionToken);
    await _storage.delete(key: _keyRefreshToken);
    await _storage.delete(key: _keyPhone);
    await _storage.delete(key: _keyRiderId);
  }

  Future<void> clearSession() => clearSessionCredentials();

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
    await _storage.write(
        key: _keyDeviceLocked, value: locked ? 'true' : 'false');
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

  final FlutterSecureStorage _storage = const FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock_this_device,
    ),
  );

  Future<void> write(String key, Map<String, dynamic> data) async {
    final jsonString = jsonEncode(data);
    await _storage.write(key: key, value: jsonString);
  }

  Future<Map<String, dynamic>?> read(String key) async {
    try {
      final jsonString = await _storage.read(key: key);
      if (jsonString == null || jsonString.isEmpty) return null;
      final decoded = jsonDecode(jsonString);
      if (decoded is Map<String, dynamic>) {
        return decoded;
      } else if (decoded is Map) {
        return Map<String, dynamic>.from(decoded);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  Future<void> delete(String key) async {
    await _storage.delete(key: key);
  }

  Future<void> clear() async {
    await _storage.deleteAll();
  }
}
