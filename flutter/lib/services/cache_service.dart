import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// Singleton cache layer for the Voltium rider app.
///
/// All synchronous getters (`getCachedRider`, `getLocale`, `getString`) read
/// from the already-initialised [SharedPreferences] instance – **no async
/// gap** – which is critical for instant UI hydration on cold start.
class CacheService {
  // ── Singleton ───────────────────────────────────────────────────────────

  static final CacheService _instance = CacheService._internal();
  factory CacheService() => _instance;
  CacheService._internal();

  // ── Keys ────────────────────────────────────────────────────────────────

  static const _keyRiderCache = 'volt_rider_cache';
  static const _keyRiderCacheTime = 'volt_rider_cache_time';
  static const _keyRiderCacheVersion = 'volt_rider_cache_version';
  static const _keyRiderCacheTTL = 'volt_rider_cache_ttl';
  static const _keyLocale = 'volt_locale';
  static const _keyTheme = 'volt_theme';
  static const _cacheDurationHours = 24;
  static const _cacheVersion = 'v1';

  // ── SharedPreferences (nullable — safe before init) ───────────────────────

  SharedPreferences? _prefs;

  /// Call once from `main()` **before** `runApp()`.
  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Rider cache
  // ════════════════════════════════════════════════════════════════════════

  /// Persist a minimal rider payload (from `RiderModel.toCacheMap()`).
  Future<void> cacheRider(
    Map<String, dynamic> riderData, {
    int? ttlSeconds,
  }) async {
    final now = DateTime.now().toUtc();
    await _prefs?.setString(_keyRiderCache, jsonEncode(riderData));
    await _prefs?.setString(_keyRiderCacheTime, now.toIso8601String());
    await _prefs?.setString(_keyRiderCacheVersion, _cacheVersion);
    if (ttlSeconds != null) {
      final expiry = now.add(Duration(seconds: ttlSeconds)).toIso8601String();
      await _prefs?.setString(_keyRiderCacheTTL, expiry);
    }
  }

  /// **Synchronous** – returns the cached rider map or `null`.
  ///
  /// Returns only the lightweight fields cached by [cacheRider].
  Map<String, dynamic>? getCachedRider() {
    final raw = _prefs?.getString(_keyRiderCache);
    if (raw == null || raw.isEmpty) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  DateTime? getRiderCacheTime() {
    final raw = _prefs?.getString(_keyRiderCacheTime);
    if (raw == null || raw.isEmpty) return null;
    return DateTime.tryParse(raw);
  }

  String? getRiderCacheVersion() {
    return _prefs?.getString(_keyRiderCacheVersion);
  }

  DateTime? getRiderCacheExpiry() {
    final raw = _prefs?.getString(_keyRiderCacheTTL);
    if (raw == null || raw.isEmpty) return null;
    return DateTime.tryParse(raw);
  }

  bool isRiderCacheExpired() {
    final cachedAt = getRiderCacheTime();
    if (cachedAt == null) return true;

    final expiry = getRiderCacheExpiry();
    if (expiry != null) {
      return DateTime.now().toUtc().isAfter(expiry);
    }

    final now = DateTime.now().toUtc();
    return now.difference(cachedAt).inHours >= _cacheDurationHours;
  }

  bool isCacheVersionMismatched() {
    final version = getRiderCacheVersion();
    return version != null && version != _cacheVersion;
  }

  bool isRiderCacheValid() {
    return !isRiderCacheExpired() && !isCacheVersionMismatched();
  }

  Future<void> clearRiderCache() async {
    await _prefs?.remove(_keyRiderCache);
    await _prefs?.remove(_keyRiderCacheTime);
    await _prefs?.remove(_keyRiderCacheVersion);
    await _prefs?.remove(_keyRiderCacheTTL);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Pattern-based invalidation
  // ════════════════════════════════════════════════════════════════════════

  Future<int> invalidatePattern(Pattern pattern) async {
    final keys = _prefs?.getKeys() ?? {};
    int deleted = 0;
    for (final key in keys) {
      if (key.contains(pattern)) {
        await _prefs?.remove(key);
        deleted++;
      }
    }
    return deleted;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Locale
  // ════════════════════════════════════════════════════════════════════════

  /// Persist the locale code (e.g. `'en'` or `'hi'`).
  Future<void> setLocale(String localeCode) async {
    await _prefs?.setString(_keyLocale, localeCode);
  }

  /// **Synchronous** – returns `'en'` or `'hi'`, defaults to `'en'`.
  String? getLocale() {
    return _prefs?.getString(_keyLocale);
  }

  /// Clear the persisted locale so the app re-derives it from the system
  /// locale on the next launch (used by "Follow System").
  Future<void> clearLocale() async {
    await _prefs?.remove(_keyLocale);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Theme (tri-state: 'system' | 'light' | 'dark')
  // ════════════════════════════════════════════════════════════════════════

  /// Stored theme preference codes. The absence of any stored value means
  /// "follow the OS brightness".
  static const String themePreferenceSystem = 'system';
  static const String themePreferenceLight = 'light';
  static const String themePreferenceDark = 'dark';

  /// Persist the tri-state theme preference under the existing
  /// `volt_theme` key (now a string; the legacy boolean value is migrated
  /// transparently on read via [getThemePreference]).
  Future<void> setThemePreference(String mode) async {
    await _prefs?.setString(_keyTheme, mode);
  }

  /// **Synchronous** – returns `'system'`, `'light'`, `'dark'`, or `null`
  /// when the rider has never chosen (the app then follows the OS
  /// brightness). Migrates a pre-tri-state boolean `volt_theme` value on
  /// read: `true` → `'dark'`, `false` → `'light'`.
  String? getThemePreference() {
    // Read the raw value: `getString`/`getBool` throw a type-cast error on
    // a mismatched stored type, so use the untyped getter and branch on the
    // actual stored type (needed to migrate legacy bool values).
    final raw = _prefs?.get(_keyTheme);
    if (raw is String &&
        (raw == themePreferenceSystem ||
            raw == themePreferenceLight ||
            raw == themePreferenceDark)) {
      return raw;
    }
    // Legacy boolean (pre tri-state): true → dark, false → light.
    if (raw is bool) {
      return raw ? themePreferenceDark : themePreferenceLight;
    }
    return null;
  }

  /// Backwards-compat two-state persistence.
  Future<void> setDarkMode(bool isDark) async {
    await setThemePreference(
        isDark ? themePreferenceDark : themePreferenceLight);
  }

  /// Backwards-compat two-state read. Returns `null` when the rider has
  /// never chosen (i.e. following the system).
  bool? getDarkMode() {
    final pref = getThemePreference();
    if (pref == null) return null;
    return pref == themePreferenceDark;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Generic SWR API response cache (Phase 2)
  // ════════════════════════════════════════════════════════════════════════

  Future<void> cacheApiResponse(
    String endpoint,
    Map<String, dynamic> data,
  ) async {
    final key = 'swr_api_$endpoint';
    await _prefs?.setString(key, jsonEncode(data));
  }

  Map<String, dynamic>? getCachedApiResponse(String endpoint) {
    final key = 'swr_api_$endpoint';
    final raw = _prefs?.getString(key);
    if (raw == null || raw.isEmpty) return null;
    try {
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  General purpose
  // ════════════════════════════════════════════════════════════════════════

  Future<void> setString(String key, String value) async {
    await _prefs?.setString(key, value);
  }

  /// **Synchronous** read.
  String? getString(String key) {
    return _prefs?.getString(key);
  }

  Future<void> remove(String key) async {
    await _prefs?.remove(key);
  }

  /// Persist a boolean preference (e.g. `legal_accepted_v1`).
  Future<void> setBool(String key, bool value) async {
    await _prefs?.setBool(key, value);
  }

  /// **Synchronous** read of a boolean preference; `null` when unset.
  bool? getBool(String key) {
    return _prefs?.getBool(key);
  }

  /// Wipes **all** SharedPreferences entries (use with caution).
  Future<void> clearAll() async {
    await _prefs?.clear();
  }
}
