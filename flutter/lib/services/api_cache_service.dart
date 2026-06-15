class MemoryCacheService {
  static final MemoryCacheService _instance = MemoryCacheService._internal();
  factory MemoryCacheService() => _instance;
  MemoryCacheService._internal();

  final Map<String, _CacheEntry> _cache = {};
  static const int _maxEntries = 50;

  void set(String key, dynamic data,
      {Duration ttl = const Duration(minutes: 5)}) {
    if (_cache.length >= _maxEntries) {
      _evictOldest();
    }
    _cache[key] = _CacheEntry(
      data: data,
      expiresAt: DateTime.now().add(ttl),
    );
  }

  T? get<T>(String key) {
    final entry = _cache[key];
    if (entry == null) return null;

    if (DateTime.now().isAfter(entry.expiresAt)) {
      _cache.remove(key);
      return null;
    }

    return entry.data as T?;
  }

  bool has(String key) {
    return get(key) != null;
  }

  void remove(String key) {
    _cache.remove(key);
  }

  void clear() {
    _cache.clear();
  }

  void _evictOldest() {
    if (_cache.isEmpty) return;

    String? oldestKey;
    DateTime? oldestTime;

    for (final entry in _cache.entries) {
      if (oldestTime == null || entry.value.expiresAt.isBefore(oldestTime)) {
        oldestKey = entry.key;
        oldestTime = entry.value.expiresAt;
      }
    }

    if (oldestKey != null) {
      _cache.remove(oldestKey);
    }
  }
}

class _CacheEntry {
  final dynamic data;
  final DateTime expiresAt;

  _CacheEntry({required this.data, required this.expiresAt});
}

class ApiResponseCache {
  static final ApiResponseCache _instance = ApiResponseCache._internal();
  factory ApiResponseCache() => _instance;
  ApiResponseCache._internal();

  final MemoryCacheService _cache = MemoryCacheService();

  Future<Map<String, dynamic>?> get(
      String endpoint, Map<String, String>? params) async {
    final key = _makeKey(endpoint, params);
    return _cache.get(key);
  }

  void set(
      String endpoint, Map<String, String>? params, Map<String, dynamic> data,
      {Duration ttl = const Duration(minutes: 2)}) {
    final key = _makeKey(endpoint, params);
    _cache.set(key, data, ttl: ttl);
  }

  void invalidate(String endpoint, [Map<String, String>? params]) {
    final key = _makeKey(endpoint, params);
    _cache.remove(key);
  }

  void invalidateAll() {
    _cache.clear();
  }

  String _makeKey(String endpoint, Map<String, String>? params) {
    if (params == null || params.isEmpty) {
      return endpoint;
    }
    final sortedParams = params.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return '$endpoint?${sortedParams.map((e) => '${e.key}=${e.value}').join('&')}';
  }
}
